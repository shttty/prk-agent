import assert from "node:assert/strict";

export function checkTargetIdentity(details, turn, marker, tempRoot, sessionId) {
  assert.equal(details.fixture, "remote-extension-ui");
  assert.equal(details.operation, turn.args.operation);
  assert.equal(details.token, turn.args.token);
  assert.equal(details.marker, marker, "the isolated target process received the requested environment");
  assert.equal(details.cwd, tempRoot, "the extension executed in the target cwd, not the Gateway cwd");
  assert.notEqual(details.pid, process.pid);
  assert.ok(Number.isSafeInteger(details.pid) && details.pid > 0);
  assert.equal(details.sessionId, sessionId, "Pi's session identity reached the target callback");
  assert.equal(details.mode, "rpc");
  assert.equal(details.hasUI, true);
  assert.equal(details.factoryCalls, 0);
  assert.equal(details.rendererCalls, 0);
}
