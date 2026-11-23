import assert from "node:assert/strict";
import { test } from "node:test";
import { createHistoryRecord } from "./create-history-record.mjs";
import { indexRecords } from "../../../../src/sessions/history/catalog/index-records.ts";
import { recordReadIssue } from "../../../../src/sessions/history/diagnostics/record-read-issue.ts";
import { readIssues } from "../../../../src/sessions/history/diagnostics/read-issues.ts";
import { get } from "../../../../src/sessions/history/catalog/get.ts";
import { getRecord } from "../../../../src/sessions/history/catalog/find-record.ts";

test("sessions sharing a display label retain independent native identities", () => {
  const good = createHistoryRecord("healthy", "healthy-id");
  const first = createHistoryRecord("same label", "first-id");
  const second = createHistoryRecord("same label", "second-id");
  const readFailures = new Map();
  const records = indexRecords([good, first, second], readFailures);
  const ctx = { records, readFailures, limits: good.limits };
  assert.deepEqual([...records.keys()], ["healthy-id", "first-id", "second-id"]);
  assert.deepEqual(readIssues(ctx), []);
  assert.equal(getRecord(ctx, good.sessionId), good);
  for (const record of [first, second]) {
    assert.equal(get(ctx, record.sessionId).sessionId, record.sessionId);
    assert.equal(getRecord(ctx, record.sessionId), record);
  }
});

test("an unreadable native identity quarantines its readable peer, not a different identity", () => {
  const good = createHistoryRecord("healthy", "healthy-id");
  const peer = createHistoryRecord("blocked", "bad-id");
  peer.sessionFile = "/sessions/peer.jsonl";
  const readFailures = new Map();
  const cause = new Error("Invalid session history native session state at /autoRetry.");
  recordReadIssue(readFailures, {
    location: "active", sessionId: "bad-id", sessionFile: "/sessions/bad-id.jsonl",
  }, cause, true);
  const records = indexRecords([good, peer], readFailures);
  const ctx = { records, readFailures, limits: good.limits };
  assert.deepEqual([...records.keys()], ["healthy-id"]);
  assert.deepEqual([...readFailures.values()].map(({ issue }) => issue.sessionId), ["bad-id", "bad-id"]);
  assert.equal(readFailures.get("/sessions/bad-id.jsonl").error.cause, cause);
  assert.throws(() => get(ctx, "bad-id"), (error) => {
    assert.match(error.message, /bad-id.*\/sessions\/bad-id\.jsonl/);
    assert.ok(error.cause instanceof Error);
    assert.match(error.cause.message, /autoRetry/);
    return true;
  });
});
