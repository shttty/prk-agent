import assert from "node:assert/strict";
import { test } from "node:test";
import { describeCommandError } from "../../../src/application/command-line/describe-command-error.ts";
import { CapabilityDiscoveryError } from "../../../src/sessions/global-catalog/discovery-error.ts";

test("startup diagnostics retain discovery details without printing arbitrary provider errors", () => {
  const provider = new Error("provider-key-test-secret");
  const diagnostic = new CapabilityDiscoveryError(["npm:fixture (session_start): startup failed"]);
  const message = describeCommandError(new AggregateError([diagnostic, provider], "cleanup failed"));
  assert.match(message, /npm:fixture \(session_start\): startup failed/);
  assert.doesNotMatch(message, /provider-key-test-secret/);
  assert.doesNotMatch(describeCommandError(provider), /provider-key-test-secret/);
});
