import assert from "node:assert/strict";
import { test } from "node:test";
import { createHistoryRecord } from "./create-history-record.mjs";
import { readNativeSessionState } from "../../../../src/sessions/history/read-native-session-state.ts";
import { projectReadableSessions } from "../../../../src/sessions/history/catalog/project-readable-sessions.ts";
import { readStoredSession } from "../../../../src/sessions/history/catalog/read-stored-session.ts";
import { readIssues } from "../../../../src/sessions/history/diagnostics/read-issues.ts";
import { formatReadIssue } from "../../../../src/sessions/history/format-read-issue.ts";
import { describeSession } from "../../../../src/sessions/history/diagnostics/describe-session.ts";
import { loadRecord } from "../../../../src/sessions/history/catalog/load-record.ts";
import { ARCHIVED_STATE_TYPE } from "../../../../src/sessions/history/history-protocol.ts";
import { SessionReadError } from "../../../../src/sessions/history/read-error.ts";

function project(record) {
  readNativeSessionState(record.manager, record.limits);
  return { sessionId: record.sessionId, sessionFile: record.sessionFile, label: record.manager.getSessionName() };
}

for (const archived of [false, true]) {
  test(`one unreadable ${archived ? "archived" : "active"} native state preserves the healthy projection and a diagnostic`, () => {
    const good = createHistoryRecord("healthy", "healthy-id");
    const bad = createHistoryRecord("broken", "broken-id", [
      { type: "custom", customType: "gateway-native-session-state", data: { version: 1, autoRetry: "yes" } },
      ...(archived ? [{ type: "custom", customType: ARCHIVED_STATE_TYPE, data: { version: 1, sessionId: "broken-id", trashed: true, group: "broken", at: "2026-11-02T00:00:00Z" } }] : []),
    ]);
    const ctx = { readFailures: new Map() };
    assert.deepEqual(projectReadableSessions(ctx, [good, bad], project).map((row) => row.sessionId), [good.sessionId]);
    const [issue] = readIssues(ctx);
    assert.equal(issue.sessionId, bad.sessionId);
    assert.equal(issue.sessionFile, bad.sessionFile);
    assert.equal(Object.hasOwn(issue, "name"), false);
    assert.equal(issue.label, "Title broken");
    assert.equal(issue.target, "local");
    assert.equal(issue.location, archived ? "archived" : "active");
    assert.match(issue.reason, /native session state.*\/autoRetry/);
    assert.equal(Object.isFrozen(issue), true);
    assert.equal(Object.isFrozen(readIssues(ctx)), true);
    assert.throws(() => readStoredSession(ctx, bad, project), (error) => {
      assert.ok(error instanceof SessionReadError);
      assert.equal(error.issue.sessionId, bad.sessionId);
      assert.match(error.message, /broken-id.*\/sessions\/broken-id\.jsonl.*\/autoRetry/);
      assert.match(error.cause.message, /\/autoRetry/);
      return true;
    });
    assert.equal(readStoredSession(ctx, good, project).sessionId, "healthy-id");
    assert.equal(readIssues(ctx).length, 1);
  });
}

test("a later successful projection clears only that session's transient diagnostic", () => {
  const record = createHistoryRecord("recoverable", "recoverable-id");
  const ctx = { readFailures: new Map() };
  const original = new Error("Unreadable /phase");
  projectReadableSessions(ctx, [record], () => { throw original; });
  assert.equal(readIssues(ctx).length, 1);
  assert.equal(ctx.readFailures.get(record.sessionFile).error.cause, original);
  projectReadableSessions(ctx, [record], project);
  assert.deepEqual(readIssues(ctx), []);
});

test("invalid archive placement is unknown rather than guessed active", () => {
  const record = createHistoryRecord("broken", "broken-id", [
    { type: "custom", customType: ARCHIVED_STATE_TYPE, data: { version: 1, sessionId: "broken-id", trashed: "yes" } },
  ]);
  const details = describeSession(record.manager, record.limits);
  assert.equal(details.display.location, "unknown");
  assert.equal(details.display.archived, undefined);
  assert.equal(Object.hasOwn(details, "route"), false);
});


test("wire diagnostics expose only their public fields, not an SDK manager", () => {
  const record = createHistoryRecord("safe", "safe-id");
  const issue = formatReadIssue({ ...record, location: "active", label: "Safe" }, new Error("Invalid /phase"));
  assert.deepEqual(Object.keys(issue).sort(), ["label", "location", "reason", "sessionFile", "sessionId", "target"]);
  assert.equal(issue.reason, "Invalid /phase");
});

for (const [field, value, pointer] of [["autoRetry", "yes", "/autoRetry"], ["models", ["invalid"], "/models/0"], ["localTools", 1, "/localTools"]]) {
  test(`native validation identifies ${pointer} during an atomic catalog read`, () => {
    const record = createHistoryRecord("broken", "broken-id", [
      { type: "custom", customType: "gateway-native-session-state", data: { version: 1, [field]: value } },
    ]);
    assert.throws(() => loadRecord(record.manager, record.sessionFile, record.sessionId, "/sessions", record.limits), (error) => {
      assert.ok(error.message.includes(pointer));
      return true;
    });
  });
}

test("native capability state accepts lazy keys and rejects the retired namespace", () => {
  const capabilities = { "lazy:tool:probe": true, "lazy:group:tools:package:fixture": false };
  const record = createHistoryRecord("lazy", "lazy-id", [
    { type: "custom", customType: "gateway-native-session-state", data: { version: 1, capabilities } },
    { type: "custom", customType: "gateway-native-session-state", data: { version: 1, capabilities: { "lazy:tool:probe": null } } },
  ]);
  assert.deepEqual(readNativeSessionState(record.manager).capabilities, { "lazy:group:tools:package:fixture": false });
  for (const id of Object.keys(capabilities).map((id) => id.replace(/^lazy:/u, "delay:"))) {
    for (const enabled of [true, false, null]) {
      const invalid = createHistoryRecord("retired", "retired-id", [
        { type: "custom", customType: "gateway-native-session-state", data: { version: 1, capabilities: { [id]: enabled } } },
      ]);
      assert.throws(() => readNativeSessionState(invalid.manager), /native session state.*\/capabilities/u);
    }
  }
});
