import type { SessionReadIssue, StoredSession } from "../../../sessions/history/history-types.ts";
import { formatReadIssue } from "../../../sessions/history/format-read-issue.ts";
import { SessionReadError } from "../../../sessions/history/read-error.ts";

export function describeReadFailure(entry: StoredSession, cause: unknown): SessionReadIssue {
  if (cause instanceof SessionReadError) return cause.issue;
  return formatReadIssue({
    sessionId: entry.sessionId,
    sessionFile: entry.sessionFile,
    label: entry.label,
    target: entry.target,
    location: entry.archived ? "archived" : "active",
    ...(entry.archived ? { archived: entry.archived } : {}),
  }, cause);
}
