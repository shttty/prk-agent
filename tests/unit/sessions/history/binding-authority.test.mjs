import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { projectAuthorityEntries } from "../../../../src/sessions/history/format-authority-entries.ts";

test("a session binding admits only its own authority entries", () => {
  const manager = SessionManager.inMemory("/fixture");
  const sessionId = manager.getSessionId();
  manager.appendCustomEntry("gateway-session-binding", { version: 4, target: "local", cwd: "/fixture", sessionId });
  manager.appendCustomEntry("gateway-derived-session", { sessionId, taskId: "own" });
  manager.appendCustomEntry("gateway-derived-session", { sessionId: "another-session", taskId: "foreign" });
  const authority = projectAuthorityEntries(manager).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-session");
  assert.deepEqual(authority.map((entry) => entry.data.taskId), ["own"]);
});
