import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { readDerivedSession } from "../../../../src/sessions/derivation/read-derived-session.ts";

const state = {
  createdBy: "parent", owner: "parent", taskId: "task", task: "Inspect the fixture",
  lifecycle: "temporary", phase: "working", model: "fixture/model", thinkingLevel: "off",
};

for (const [name, invalid, path] of [
  ["invalid phase", { phase: "acknowledged" }, "/phase"],
  ["obsolete field", { destroyDelegates: true }, "/destroyDelegates"],
]) {
  test(`derived metadata reports ${name} without accepting it`, () => {
    const manager = SessionManager.inMemory("/fixture");
    const sessionId = manager.getSessionId();
    manager.appendCustomEntry("gateway-session-binding", { version: 4, target: "local", cwd: "/fixture", sessionId });
    manager.appendCustomEntry("gateway-derived-session", { ...state, ...invalid, sessionId });
    assert.throws(() => readDerivedSession(manager), (error) => {
      assert(error instanceof Error);
      assert(error.message.includes(path));
      return true;
    });
    assert.deepEqual(manager.getEntries().at(-1).data, { ...state, ...invalid, sessionId });
  });
}
