import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { DEFAULT_LIMITS_OPTIONS as limits } from "../../../src/config/limits/limits-options.ts";
import { DEFAULT_HTTP_OPTIONS as http } from "../../../src/config/http/http-options.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { dispatchRequest } from "../../../src/gateway/socket-server/dispatch/dispatch-request.ts";
import { kernelExecutionGet } from "../../../src/gateway/kernel-execution/read-settings.ts";
import { kernelExecutionSet } from "../../../src/gateway/kernel-execution/save-settings.ts";
import { handleRequest } from "../../../src/http/listener/requests/handle-request.ts";

const origin = "http://127.0.0.1:18790";
const path = "/api/settings/kernel-execution";
const wire = (method, params) => ({ v: 1, id: 1, method, params });
const invalid = [{}, { asyncExecution: false, extra: true }, { asyncExecution: true, sessionId: "session-a" },
  ...[null, "false", 0, 1, [], {}].map((asyncExecution) => ({ asyncExecution }))];
function request(method, body, headers = {}, url = path) {
  const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return Object.assign(Readable.from(data ? [data] : []), { method, url, headers: {
    host: "127.0.0.1:18790", origin, "content-type": "application/json", ...(data ? { "content-length": String(data.length) } : {}), ...headers,
  } });
}
function response() {
  return { setHeader() {}, writeHead(status) { this.status = status; }, end(data) { this.body = JSON.parse(data); } };
}
function context() {
  const calls = [];
  return { calls, ctx: { origin, authority: "127.0.0.1:18790", host: "127.0.0.1", stopping: false, http, limits,
    gateway: { call: async (method, params) => { calls.push([method, params]); return { asyncExecution: params.asyncExecution ?? true }; } } } };
}

test("kernel execution wire accepts only global empty reads and one boolean writes", async () => {
  assert.deepEqual(validateRequest(wire("kernelExecutionGet", {})).params, {});
  for (const asyncExecution of [false, true]) {
    const params = { asyncExecution };
    assert.deepEqual(validateRequest(wire("kernelExecutionSet", params)).params, params);
  }
  for (const params of invalid) {
    assert.throws(() => validateRequest(wire("kernelExecutionSet", params)), { code: "INVALID_REQUEST" });
    await assert.rejects(kernelExecutionSet({}, params), { code: "INVALID_REQUEST" });
  }
  for (const params of [{ asyncExecution: true }, { sessionId: "session-a" }]) {
    assert.throws(() => validateRequest(wire("kernelExecutionGet", params)), { code: "INVALID_REQUEST" });
  }
});

test("kernel execution socket dispatch uses the dedicated global reader and writer", async () => {
  const calls = [], replies = [];
  const host = {
    kernelExecutionGet: () => { calls.push(["get"]); return { asyncExecution: true }; },
    kernelExecutionSet: async (params) => { calls.push(["set", params]); return params; },
  };
  for (const [method, params] of [["kernelExecutionGet", {}], ["kernelExecutionSet", { asyncExecution: false }]]) {
    await dispatchRequest({ listener: { host } }, (id, value) => replies.push([id, value]), validateRequest(wire(method, params)));
  }
  assert.deepEqual(calls, [["get"], ["set", { asyncExecution: false }]]);
  assert.deepEqual(replies, [[1, { asyncExecution: true }], [1, { asyncExecution: false }]]);
  const ctx = { host: { config: { kernel: { asyncExecution: true, executionTimeoutMs: 0, reminderLadderMs: [1] } } } };
  assert.deepEqual(kernelExecutionGet(ctx), { asyncExecution: true });
  ctx.host.config.kernel.asyncExecution = false;
  assert.deepEqual(kernelExecutionGet(ctx), { asyncExecution: false });
});

test("HTTP global setting validates and forwards GET and same-origin POST without envelopes", async () => {
  const { calls, ctx } = context();
  for (const [method, body] of [["GET", undefined], ["POST", { asyncExecution: false }], ["POST", { asyncExecution: true }]]) {
    const result = response();
    await handleRequest(ctx, request(method, body), result);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { asyncExecution: body?.asyncExecution ?? true });
  }
  assert.deepEqual(calls, [["kernelExecutionGet", {}], ["kernelExecutionSet", { asyncExecution: false }], ["kernelExecutionSet", { asyncExecution: true }]]);
});

test("HTTP setting rejects invalid source, method, fields, size and queries before Gateway calls", async () => {
  const { calls, ctx } = context();
  const post = { asyncExecution: false };
  for (const headers of [{ origin: undefined }, { origin: "http://other.invalid" }, { "sec-fetch-site": "cross-site" }, { host: "other.invalid" }]) {
    await assert.rejects(handleRequest(ctx, request("POST", post, headers), response()), { status: 403 });
  }
  for (const body of invalid) await assert.rejects(handleRequest(ctx, request("POST", body), response()), { status: 400, code: "INVALID_REQUEST" });
  await assert.rejects(handleRequest(ctx, request("DELETE"), response()), { status: 405 });
  await assert.rejects(handleRequest(ctx, request("POST", post, { "content-type": "text/plain" }), response()), { status: 415 });
  await assert.rejects(handleRequest(ctx, request("POST", post, { "content-length": String(http.bodyBytes + 1) }), response()), { status: 413 });
  await assert.rejects(handleRequest(ctx, request("GET", undefined, {}, `${path}?sessionId=session-a`), response()), { status: 400 });
  assert.deepEqual(calls, []);
});
