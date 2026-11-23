import type { HistoryContext, StoredSession, HistoryRecord } from "../history-types.ts";
import { stored } from "./format-stored-session.ts";
import { readStoredSession } from "./read-stored-session.ts";

export function projectReadableSessions(
  ctx: HistoryContext,
  records: Iterable<HistoryRecord>,
  project: (record: HistoryRecord) => StoredSession = stored,
): readonly StoredSession[] {
  const entries: StoredSession[] = [];
  for (const record of records) {
    try { entries.push(readStoredSession(ctx, record, project)); } catch { /* The diagnostic retains this session. */ }
  }
  return Object.freeze(entries);
}
