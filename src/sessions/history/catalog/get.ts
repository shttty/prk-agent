import type { HistoryContext, StoredSession } from "../history-types.ts";
import { validateMetadataSessionId } from "../identity/validate-metadata-session-id.ts";
import { readStoredSession } from "./read-stored-session.ts";
import { getRecord } from "./find-record.ts";

export function get(ctx: HistoryContext, sessionId: string): StoredSession | undefined {
  validateMetadataSessionId(sessionId, "session identity", ctx.limits);
  const record = getRecord(ctx, sessionId);
  return record === undefined ? undefined : readStoredSession(ctx, record);
}
