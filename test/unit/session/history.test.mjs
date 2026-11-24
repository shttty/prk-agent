import assert from "node:assert/strict";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { projectBranchPage } from "../../../src/sessions/history/project-branch-page.ts";

test("page boundary retains whole turns and a branch pivot drops the abandoned suffix", () => {
  const sessions = SessionManager.inMemory();
  const turn = (n) => [sessions.appendMessage({ role: "user", content: `question ${n}`, timestamp: n }), sessions.appendMessage(fauxAssistantMessage(`answer ${n}`))];
  const turns = Array.from({ length: 51 }, (_, n) => turn(n));
  const tail = projectBranchPage(sessions);
  assert.equal(tail.historyBefore, turns[1][0]);
  assert.deepEqual(tail.messageEntryIds, turns.slice(1).flat());
  assert.deepEqual(projectBranchPage(sessions, { before: tail.historyBefore }).messageEntryIds, turns[0]);
  sessions.branch(turns[1][1]);
  const alternate = turn(100);
  assert.deepEqual(projectBranchPage(sessions).messageEntryIds, [...turns[0], ...turns[1], ...alternate]);
});
