import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LIMITS_OPTIONS as limits } from "../../../src/config/limits/limits-options.ts";
import { DEFAULT_HTTP_OPTIONS as http } from "../../../src/config/http/http-options.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { dispatchRequest } from "../../../src/gateway/socket-server/dispatch/dispatch-request.ts";
import { routePath } from "../../../src/http/request/parse-request-url.ts";
import { routeSessionPath } from "../../../src/http/session-routes/parse-session-route.ts";
import { validateSessionMethod } from "../../../src/http/session-routes/validate-session-method.ts";
import { handleSessionRequest } from "../../../src/http/session-routes/handle-session-request.ts";

const cellId = "01234567-89ab-4cde-8fab-0123456789ab";
const sessionId = "session-a";
const origin = "http://localhost";
const path = `/api/sessions/${sessionId}/kernel/result`;
const params = { sessionId, cellId };
const request = (p) => ({ v: 1, id: 1, method: "kernelResult", params: p });
const url = (query) => routePath(limits, { method: "GET", url: `${path}${query}` }, origin);

function response() {
  return { status: undefined, body: undefined, writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
}

test("kernelResult validates UUID cell identity and bounded optional image index", () => {
  for (const p of [params, { ...params, imageIndex: 1 }, { ...params, imageIndex: 2_147_483_647 }]) {
    assert.deepEqual(validateRequest(request(p)).params, p);
  }
  for (const p of [{ ...params, extra: true }, { ...params, kernelId: "other" }, { ...params, cellId: "cell-a" },
    { ...params, cellId: "a/b" }, { ...params, sessionId: "../session" }, { cellId }]) {
    assert.throws(() => validateRequest(request(p)), { code: "INVALID_REQUEST" });
  }
  for (const imageIndex of [null, "1", 0, -1, 0.5, NaN, Infinity, 2_147_483_648, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => validateRequest(request({ ...params, imageIndex })), { code: "INVALID_REQUEST" });
  }
});

test("HTTP result accepts only its declared GET route and single query identities", () => {
  assert.deepEqual(routeSessionPath(limits, path), { sessionId, action: "kernel/result" });
  validateSessionMethod({ method: "GET" }, "kernel/result");
  assert.throws(() => validateSessionMethod({ method: "POST" }, "kernel/result"), { status: 405 });
  assert.throws(() => routeSessionPath(limits, `${path}/extra`), { status: 404 });
  assert.equal(url(`?cellId=${cellId}`).searchParams.get("cellId"), cellId);
  assert.equal(url(`?cellId=${cellId}&imageIndex=1`).searchParams.get("imageIndex"), "1");
  for (const query of ["?imageIndex=1", `?cellId=${cellId}&cellId=${cellId}`, `?cellId=${cellId}&imageIndex=1&imageIndex=2`,
    `?cellId=${cellId}&sessionId=other`, `?cellId=${cellId}&extra=true`, "?cellId=cell-a"]) {
    assert.throws(() => url(query), { status: 400 });
  }
  for (const imageIndex of ["", "0", "-1", "01", "1.1", "1e0", "+1", " 1", "2147483648", "NaN", "Infinity"]) {
    assert.throws(() => url(`?cellId=${cellId}&imageIndex=${encodeURIComponent(imageIndex)}`), { status: 400 });
  }
});

test("socket result dispatch reads directly without acquiring a session host", async () => {
  const calls = [], replies = [];
  const result = { ...params, delivery: "unknown", outcome: "unknown", imageCount: 0 };
  const ctx = { listener: { stopping: false, host: { kernelResult: (...args) => { calls.push(args); return result; } } } };
  await dispatchRequest(ctx, (id, value) => replies.push({ id, value }), validateRequest(request({ ...params, imageIndex: 2 })));
  assert.deepEqual(calls, [[sessionId, cellId, 2]]);
  assert.deepEqual(replies, [{ id: 1, value: result }]);
});

test("HTTP session dispatch forwards result reads and rejects invalid requests before Gateway calls", async () => {
  const calls = [];
  const result = { ...params, delivery: "unconfirmed", imageCount: 1 };
  const ctx = { http, limits, gateway: { call: async (method, p) => { calls.push([method, p]); return result; } } };
  const first = response(), second = response();
  await handleSessionRequest(ctx, { method: "GET" }, first, url(`?cellId=${cellId}`));
  await handleSessionRequest(ctx, { method: "GET" }, second, url(`?cellId=${cellId}&imageIndex=1`));
  assert.deepEqual(calls, [["kernelResult", params], ["kernelResult", { ...params, imageIndex: 1 }]]);
  assert.equal(first.status, 200);
  assert.deepEqual(second.body, result);
  await assert.rejects(handleSessionRequest(ctx, { method: "GET" }, response(), new URL(path, origin)), { status: 400 });
  await assert.rejects(handleSessionRequest(ctx, { method: "POST" }, response(), url(`?cellId=${cellId}`)), { status: 405 });
  assert.equal(calls.length, 2);
});
