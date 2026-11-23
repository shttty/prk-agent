import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { HistoryTurnTooLarge, projectBranchPage } from "../../../../src/sessions/history/project-branch-page.ts";

test("projects only the current JSONL branch, with complete turns and compaction cut points", () => {
  const root = mkdtempSync(join(tmpdir(), "prk-history-page-"));
  try {
    const manager = SessionManager.create(root, root);
    const intro = manager.appendCustomMessageEntry("fixture", "before the first user", true);
    const users = [], replies = [], marks = [];
    for (let turn = 1; turn <= 105; turn++) {
      users[turn] = manager.appendMessage({ role: "user", content: `turn ${turn}`, timestamp: turn });
      replies[turn] = manager.appendMessage(fauxAssistantMessage(`reply ${turn}`));
      if (turn === 48) marks.push(manager.appendCompaction("first summary", replies[40], 1000));
      if (turn === 90) marks.push(manager.appendCompaction("second summary", users[85], 2000));
    }
    const saved = SessionManager.open(manager.getSessionFile());
    const modelMessages = saved.buildSessionContext().messages;
    assert.equal(modelMessages.some((m) => m.role === "user" && m.content === "turn 1"), false);
    assert.equal(modelMessages.some((m) => m.role === "compactionSummary"), true);

    const latest = projectBranchPage(saved);
    assert.equal(latest.messages.length, 100);
    assert.equal(latest.messageEntryIds[0], users[56]);
    assert.equal(latest.messageEntryIds.at(-1), replies[105]);
    assert.equal(latest.historyBefore, users[56]);
    assert.equal(latest.historyForkBefore, replies[55]);
    assert.deepEqual(latest.compactions, [{ entryId: marks[1], firstKeptEntryId: users[85], beforeEntryId: users[85], summary: "second summary" }]);
    const older = projectBranchPage(saved, { before: latest.historyBefore });
    assert.equal(older.messages.length, 100);
    assert.equal(older.historyBefore, users[6]);
    assert.equal(older.messageEntryIds.at(-1), replies[55]);
    assert.deepEqual(older.compactions, [{ entryId: marks[0], firstKeptEntryId: replies[40], beforeEntryId: replies[40], summary: "first summary" }]);
    const beginning = projectBranchPage(saved, { before: older.historyBefore });
    assert.equal(beginning.historyBefore, null);
    assert.equal(beginning.messageEntryIds[0], intro);
    assert.equal(beginning.messageEntryIds.at(-1), replies[5]);
    assert.deepEqual(saved.buildSessionContext().messages, modelMessages);

    // Exactly 50 turns include the prelude, and navigating the native tree excludes its abandoned suffix.
    saved.branch(replies[50]);
    const exact = projectBranchPage(saved);
    assert.equal(exact.historyBefore, null);
    assert.equal(exact.messages.length, 101);
    assert.deepEqual(exact.compactions.map((m) => m.entryId), [marks[0]]);
    assert.equal(projectBranchPage(saved, { before: latest.historyBefore }), null);
    saved.branch(replies[4]);
    const alternate = saved.appendMessage({ role: "user", content: "alternate branch", timestamp: 999 });
    const alternateReply = saved.appendMessage(fauxAssistantMessage("alternate reply"));
    const branched = projectBranchPage(SessionManager.open(saved.getSessionFile()));
    assert.equal(branched.historyBefore, null);
    assert.deepEqual(branched.messageEntryIds.slice(-3), [replies[4], alternate, alternateReply]);
    assert.deepEqual(branched.compactions, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("fits complete projected turns in the byte budget, anchored to exactly the observed leaf", () => {
  const manager = SessionManager.inMemory();
  const append = (text) => {
    const userId = manager.appendMessage({ role: "user", content: [{ type: "text", text: text.repeat(180) }], timestamp: 1 });
    const replyId = manager.appendMessage(fauxAssistantMessage(text.repeat(90)));
    return [userId, replyId];
  };
  const [u1, a1] = append("旧");
  const [u2, a2] = append("新");
  append("未");
  const budget = { bytes: 1800, projectMessage: (value) => value };
  const page = projectBranchPage(manager, { through: a2 }, budget);
  assert.deepEqual(page.messageEntryIds, [u2, a2]);
  assert.equal(page.historyBefore, u2);
  assert.equal(page.historyForkBefore, a1);
  const pageBytes = Buffer.byteLength(JSON.stringify(page));
  assert(pageBytes <= budget.bytes);
  assert.deepEqual(projectBranchPage(manager, { through: a2 }, { ...budget, bytes: pageBytes }), page);
  assert.throws(() => projectBranchPage(manager, { through: a2 }, { ...budget, bytes: pageBytes - 1 }),
    (error) => error instanceof HistoryTurnTooLarge && error.entryId === u2 && error.bytes === pageBytes);
  assert.deepEqual(projectBranchPage(manager, { before: u2 }, budget).messageEntryIds, [u1, a1]);
  manager.branch(a1);
  assert.equal(projectBranchPage(manager, { through: a2 }, budget), null);
});
