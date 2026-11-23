import assert from "node:assert/strict";
import { test } from "node:test";
import { createHistoryRecord } from "./create-history-record.mjs";
import { loadRecord } from "../../../../src/sessions/history/catalog/load-record.ts";
import { ARCHIVED_STATE_TYPE, PROJECT_TYPE, SESSION_RETARGET_TYPE } from "../../../../src/sessions/history/history-protocol.ts";

for (const [category, corrupt, pointer] of [
  ["binding", (entries) => { entries[0].data.target = 42; }, "/target"],
  ["cwd", (entries) => { entries[0].data.cwd = "relative"; }, "/cwd"],
  ["project", (entries) => { entries.push({ type: "custom", customType: PROJECT_TYPE, data: { version: 1, project: { id: "project", name: "\n" } } }); }, "/project/name"],
  ["archive", (entries) => { entries.push({ type: "custom", customType: ARCHIVED_STATE_TYPE, data: { version: 1, sessionId: "broken-id", trashed: true, group: "invalid/group", at: "2026-11-02T00:00:00Z" } }); }, "/group"],
  ["retarget", (entries) => { entries.push({ type: "custom", customType: SESSION_RETARGET_TYPE, data: { version: 2, sessionId: "broken-id", target: "local", cwd: "." } }); }, "/cwd"],
]) {
  test(`${category} load validation preserves its specific field path`, () => {
    const record = createHistoryRecord("broken", "broken-id");
    corrupt(record.manager.getEntries());
    const before = structuredClone(record.manager.getEntries());
    assert.throws(() => loadRecord(record.manager, record.sessionFile, record.sessionId, "/sessions", record.limits), (error) => {
      assert.ok(error.message.includes(pointer));
      return true;
    });
    assert.deepEqual(record.manager.getEntries(), before, "validation never repairs persisted metadata");
  });
}


test("a valid catalog read retains the original native identity", () => {
  const record = createHistoryRecord("healthy", "native-id");
  const loaded = loadRecord(record.manager, record.sessionFile, record.sessionId, "/sessions", record.limits);
  assert.equal(loaded.manager, record.manager);
  assert.equal(loaded.sessionId, "native-id");
  assert.equal(loaded.sessionFile, "/sessions/native-id.jsonl");
  assert.throws(() => loadRecord(record.manager, record.sessionFile, "different-id", "/sessions", record.limits), /binding session id/);
});
