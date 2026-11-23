import type { SessionReadFailure, HistoryRecord } from "../history-types.ts";
import { invalid } from "../reject-invalid-history.ts";
import { describeSession } from "../diagnostics/describe-session.ts";
import { recordReadIssue } from "../diagnostics/record-read-issue.ts";

export function indexRecords(loaded: readonly HistoryRecord[], readFailures: Map<string, SessionReadFailure>): Map<string, HistoryRecord> {
  const records = new Map<string, HistoryRecord>();
  const sessions = new Map<string, HistoryRecord[]>();
  const failedSessions = new Map<string, Error>();
  for (const failure of readFailures.values()) {
    if (failure.permanent && failure.issue.sessionId !== undefined) failedSessions.set(failure.issue.sessionId, failure.error);
  }
  for (const record of loaded) {
    const members = sessions.get(record.sessionId) ?? [];
    members.push(record);
    sessions.set(record.sessionId, members);
  }
  for (const [sessionId, members] of sessions) {
    try {
      const failure = failedSessions.get(sessionId);
      if (failure) throw failure;
      if (members.length !== 1) invalid(`duplicate sessions for ${JSON.stringify(sessionId)}`);
      records.set(sessionId, members[0]!);
    } catch (cause) {
      for (const record of members) {
        const { display } = describeSession(record.manager, record.limits);
        recordReadIssue(readFailures, {
          ...display, target: display.target ?? record.target, sessionId, sessionFile: record.sessionFile,
        }, cause, true);
      }
    }
  }
  return records;
}
