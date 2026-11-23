import assert from "node:assert/strict";
import test from "node:test";
import { action } from "../../../../src/sessions/native-interaction/dispatch/dispatch-action.ts";

const target = (extensionCommands) => ({
  sessionId: "s1", streamId: "stream", state: "idle", readOnly: false,
  manager: { getTree: () => assert.fail("dispatch must not walk the session tree") },
  session: {
    modelRuntime: { getModels: () => assert.fail("dispatch must not enumerate models"), getAvailableSnapshot: () => assert.fail("dispatch must not enumerate models") },
    extensionRunner: {
      getRegisteredCommands: () => extensionCommands.map((name) => ({ invocationName: name })),
      getCommandDiagnostics: () => [],
      getCommand: (name) => (extensionCommands.includes(name) ? {} : undefined),
    },
    resourceLoader: { getExtensions: () => ({ extensions: [], errors: [] }), getSkills: () => ({ skills: [], diagnostics: [] }), getPrompts: () => ({ prompts: [] }) },
    settingsManager: { getEnableSkillCommands: () => true },
  },
});
const run = (extensionCommands) => action({ activeRequests: new Set(), running: new Map() }, target(extensionCommands), { requestId: "r1", sessionId: "s1", action: "quit" });

test("dispatching one builtin resolves only that command", async () => {
  const result = await run([]);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.data, { leftView: true, gatewayStopped: false });
});

test("an extension command still overrides the same-named builtin", async () => {
  const result = await run(["quit"]);
  assert.equal(result.status, "unavailable");
  assert.equal(result.data.executed, false);
  assert.match(result.message, /slash-command send/);
});
