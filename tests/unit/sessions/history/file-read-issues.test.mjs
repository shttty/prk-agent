import { DEFAULT_LIMITS_OPTIONS } from "../../../../src/config/limits/limits-options.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatReadIssue } from "../../../../src/sessions/history/format-read-issue.ts";
import { recordReadIssue } from "../../../../src/sessions/history/diagnostics/record-read-issue.ts";
import { readIssues } from "../../../../src/sessions/history/diagnostics/read-issues.ts";
import { get } from "../../../../src/sessions/history/catalog/get.ts";
import { SessionReadError } from "../../../../src/sessions/history/read-error.ts";

for (const sessionId of [undefined, null, 42, "", "  ", "\n\t"]) {
  test(`an invalid native id (${JSON.stringify(sessionId)}) is reported only by file`, () => {
    const cause = new Error("Invalid worker history binding session id at /id.");
    const identity = { sessionId, sessionFile: "/sessions/broken-header.jsonl", location: "active", label: "Broken header" };
    const issue = formatReadIssue(identity, cause);
    assert.equal(Object.hasOwn(issue, "sessionId"), false);
    assert.equal(issue.sessionFile, identity.sessionFile);
    assert.equal(issue.location, "unknown");
    assert.equal(issue.label, "Broken header");
    assert.match(issue.reason, /\/id/);
    const readFailures = new Map();
    const error = recordReadIssue(readFailures, identity, cause, true);
    assert.ok(error instanceof SessionReadError);
    assert.deepEqual(error.issue, issue);
    assert.equal(error.cause, cause);
    assert.match(error.message, /Cannot read session at "\/sessions\/broken-header\.jsonl".*\/id/);
    assert.equal(error.message.includes("undefined"), false);
    assert.deepEqual(readIssues({ readFailures }), [issue]);
    assert.equal(get({ readFailures, records: new Map(), limits: DEFAULT_LIMITS_OPTIONS }, "broken-header"), undefined, "a filename never becomes an alternate native id");
  });
}

test("a file-only diagnostic does not need a sessionId property at all", () => {
  const issue = formatReadIssue({ location: "unknown", sessionFile: "/sessions/no-id.jsonl" }, new Error("Invalid /id"));
  assert.deepEqual(issue, { location: "unknown", sessionFile: "/sessions/no-id.jsonl", reason: "Invalid /id" });
});

test("valid native identities are preserved verbatim", () => {
  const issue = formatReadIssue({ sessionId: "native-id", location: "active", sessionFile: "/sessions/native.jsonl" }, new Error("Invalid /autoRetry"));
  assert.equal(issue.sessionId, "native-id");
  assert.equal(issue.location, "active");
});

test("a native-id diagnostic rejects when no managed record owns the id", () => {
  const readFailures = new Map();
  const error = recordReadIssue(readFailures, {
    sessionId: "broken-id", sessionFile: "/sessions/broken.jsonl", location: "active",
  }, new Error("Invalid binding at /cwd"), true);
  assert.throws(() => get({ readFailures, records: new Map(), limits: DEFAULT_LIMITS_OPTIONS }, "broken-id"), (caught) => caught === error);
});
