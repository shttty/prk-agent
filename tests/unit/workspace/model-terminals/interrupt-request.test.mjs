import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LIMITS_OPTIONS } from "../../../../src/config/limits/limits-options.ts";
import { validateRequest } from "../../../../src/gateway/wire/validate-request.ts";
import { workspaceHttpRoute } from "../../../../src/workspace/http-routes/workspace-http-route.ts";
import { nativeRequest } from "../../../../src/http/request/validate-wire-params.ts";

test("terminal interrupt requires a session, terminal, generation and command identity", () => {
  const method = "terminalInterrupt";
  const sessionId = "session-a";
  const body = { name: "main", generation: "generation-a", commandId: "command-a" };
  const params = { sessionId, ...body };
  const request = (fields) => ({ id: 1, v: 1, method, params: fields });
  assert.deepEqual(workspaceHttpRoute(`/api/sessions/${sessionId}/terminals/interrupt`), { sessionId, verb: "POST", method });
  assert.deepEqual(validateRequest(request(params)).params, params);
  assert.deepEqual(nativeRequest(DEFAULT_LIMITS_OPTIONS, body, method, sessionId), body);
  for (const invalid of [
    { ...body, generation: undefined },
    { ...body, commandId: "" },
    { ...body, data: "\x03" },
  ]) {
    assert.throws(() => validateRequest(request({ sessionId, ...invalid })), { code: "INVALID_REQUEST" });
    assert.throws(() => nativeRequest(DEFAULT_LIMITS_OPTIONS, invalid, method, sessionId), { status: 400 });
  }
});
