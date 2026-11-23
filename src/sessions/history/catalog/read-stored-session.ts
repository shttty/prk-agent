import type { HistoryContext, StoredSession, HistoryRecord } from "../history-types.ts";
import { stored } from "./format-stored-session.ts";
import { describeSession } from "../diagnostics/describe-session.ts";
import { recordReadIssue } from "../diagnostics/record-read-issue.ts";

export function readStoredSession(
  ctx: HistoryContext,
  record: HistoryRecord,
  project: (record: HistoryRecord) => StoredSession = stored,
): StoredSession {
  const sessionId = record.sessionId;
  const sessionFile = record.sessionFile;
  const previous = ctx.readFailures.get(sessionFile);
  if (previous?.permanent) throw previous.error;
  try {
    const result = project(record);
    ctx.readFailures.delete(sessionFile);
    return result;
  } catch (cause) {
    const { display } = describeSession(record.manager, record.limits);
    throw recordReadIssue(ctx.readFailures, {
      ...display, target: display.target ?? record.target, sessionId, sessionFile,
    }, cause);
  }
}
