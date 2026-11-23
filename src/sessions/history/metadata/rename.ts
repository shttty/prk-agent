import type { HistoryContext } from "../history-types.ts";
import { getRecord } from "../catalog/find-record.ts";
import { invalid } from "../reject-invalid-history.ts";

export function rename(ctx: HistoryContext, sessionId: string, label: string): void {
  const record = getRecord(ctx, sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  record.manager.appendSessionInfo(label);
}
