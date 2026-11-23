import type { HistoryContext, HistoryRecord } from "../history-types.ts";

export function getRecord(ctx: HistoryContext, sessionId: string): HistoryRecord | undefined {
  const record = ctx.records.get(sessionId);
  if (record) return record;
  for (const failure of ctx.readFailures.values()) {
    if (failure.issue.sessionId === sessionId) throw failure.error;
  }
  return undefined;
}
