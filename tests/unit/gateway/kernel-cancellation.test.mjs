import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { DEFAULT_LIMITS_OPTIONS as limits } from "../../../src/config/limits/limits-options.ts";
import { DEFAULT_HTTP_OPTIONS as http } from "../../../src/config/http/http-options.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { dispatchRequest } from "../../../src/gateway/socket-server/dispatch/dispatch-request.ts";
import { interruptCell } from "../../../src/gateway/session-hosts/input/interrupt-cell.ts";
import { nativeRequest } from "../../../src/http/request/validate-wire-params.ts";
import { routeSessionPath } from "../../../src/http/session-routes/parse-session-route.ts";
import { validateSessionMethod } from "../../../src/http/session-routes/validate-session-method.ts";
import { cancelOperation } from "../../../src/http/session-routes/cancel-operation.ts";
import { interruptKernel } from "../../../src/http/session-routes/interrupt-kernel.ts";

const cell = { kernelId: "29f5df4a-de82-435b-8b3e-aeb2a5249397/611718aa-4b7e-45c8-84e1-f3be35567d28", cellId: "cell-a" };
const request = (method, params) => ({ v: 1, id: 1, method, params });

test("cancel and kernelInterrupt validate bounded cell identities and reject unknown fields", () => {
  for (const params of [{ sessionId: "session-a", operationId: "op-a" }, { sessionId: "session-a", operationId: "op-a", cell }]) {
    assert.deepEqual(validateRequest(request("cancel", params)).params, params);
  }
  const params = { sessionId: "session-a", ...cell };
  assert.deepEqual(validateRequest(request("kernelInterrupt", params)).params, params);
  for (const invalid of [null, {}, { cellId: "cell-a" }, { ...cell, extra: true }, { ...cell, cellId: "a/b" }, { ...cell, kernelId: "\u0000" }, { ...cell, cellId: "a".repeat(limits.identityChars + 1) }]) {
    assert.throws(() => validateRequest(request("cancel", { sessionId: "session-a", operationId: "op-a", cell: invalid })), { code: "INVALID_REQUEST" });
  }
  for (const invalid of [{ ...params, operationId: "op-a" }, { ...params, kernelId: "" }, { ...params, cellId: "../cell" }, { ...params, sessionId: "../session" }, { sessionId: "session-a", cellId: "cell-a" }]) {
    assert.throws(() => validateRequest(request("kernelInterrupt", invalid)), { code: "INVALID_REQUEST" });
  }
});

test("HTTP identity is path-owned and only the declared nested interrupt route is allowed", () => {
  assert.deepEqual(routeSessionPath(limits, "/api/sessions/session-a/kernel/interrupt"), { sessionId: "session-a", action: "kernel/interrupt" });
  validateSessionMethod({ method: "POST" }, "kernel/interrupt");
  assert.throws(() => validateSessionMethod({ method: "GET" }, "kernel/interrupt"), { status: 405 });
  for (const path of ["/api/sessions/session-a/kernel/unknown", "/api/sessions/session-a/kernel/interrupt/extra", "/api/sessions/session-a/send/extra"]) {
    assert.throws(() => routeSessionPath(limits, path), { status: 404 });
  }
  assert.deepEqual(nativeRequest(limits, cell, "kernelInterrupt", "session-a"), cell);
  assert.throws(() => nativeRequest(limits, { ...cell, sessionId: "session-b" }, "kernelInterrupt", "session-a"), { status: 400 });
  assert.throws(() => nativeRequest(limits, { ...cell, operationId: "fake" }, "kernelInterrupt", "session-a"), { status: 400 });
});

test("socket dispatch uses the selected live host and forwards only supplied cell identities", async () => {
  const calls = [], replies = [];
  const source = {
    interruptCell: async (identity) => { calls.push(["interrupt", identity]); return { ...identity, status: "requested", returnedMessages: [] }; },
    cancel: async (params) => { calls.push(["cancel", params]); return { operationId: params.operationId, status: "requested", completion: Promise.resolve(), returnedMessages: [] }; },
  };
  const ctx = { listener: { stopping: false, host: { session: (sessionId) => { calls.push(["session", sessionId]); return source; } } } };
  const respond = (id, value) => replies.push({ id, value });
  await dispatchRequest(ctx, respond, validateRequest(request("kernelInterrupt", { sessionId: "session-a", ...cell })));
  await dispatchRequest(ctx, respond, validateRequest(request("cancel", { sessionId: "session-a", operationId: "op-a", cell })));
  await dispatchRequest(ctx, respond, validateRequest(request("cancel", { sessionId: "session-a", operationId: "op-a" })));
  assert.deepEqual(calls, [
    ["session", "session-a"], ["interrupt", cell],
    ["session", "session-a"], ["cancel", { operationId: "op-a", cell }],
    ["session", "session-a"], ["cancel", { operationId: "op-a" }],
  ]);
  assert.equal(replies[0].value.status, "requested");
  assert.equal("completion" in replies[1].value, false);
});

test("targeted interrupt refuses a dormant binding without attempting a wake", async () => {
  let refreshes = 0;
  const ctx = { source: undefined, binding: { refresh: () => refreshes++ }, parent: { methods: { runtimeChange: async (action) => action() } } };
  await assert.rejects(interruptCell(ctx, cell), { code: "NOT_FOUND" });
  assert.equal(refreshes, 1);
});

function httpRequest(body) {
  const payload = Buffer.from(JSON.stringify(body));
  return Object.assign(Readable.from([payload]), { method: "POST", headers: { "content-type": "application/json", "content-length": String(payload.length) } });
}
function response() {
  return { status: undefined, body: undefined, writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
}

test("HTTP cancel preserves observed cells and targeted interrupt forwards the path session", async () => {
  const calls = [];
  const ctx = { http, limits, gateway: { call: async (method, params) => { calls.push([method, params]); return { status: "requested" }; } } };
  const cancelled = response(), interrupted = response();
  await cancelOperation(ctx, httpRequest({ operationId: "op-a", cell }), cancelled, "session-a");
  await interruptKernel(ctx, httpRequest(cell), interrupted, "session-a");
  assert.deepEqual(calls, [
    ["cancel", { sessionId: "session-a", operationId: "op-a", cell }],
    ["kernelInterrupt", { sessionId: "session-a", ...cell }],
  ]);
  assert.equal(cancelled.status, 200);
  assert.equal(interrupted.status, 200);
  await assert.rejects(interruptKernel(ctx, httpRequest({ ...cell, sessionId: "session-b" }), response(), "session-a"), { status: 400 });
  assert.equal(calls.length, 2);
});
