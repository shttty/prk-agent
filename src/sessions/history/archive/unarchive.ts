import type { HistoryContext } from "../history-types.ts";
import { getRecord } from "../catalog/find-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { latestArchivedState } from "./read-archive-state.ts";
import { projectAuthorityEntries } from "../format-authority-entries.ts";
import { ARCHIVED_STATE_TYPE } from "../history-protocol.ts";

export function unarchive(ctx: HistoryContext, sessionId: string): void {
  const { limits } = ctx;
  const record = getRecord(ctx, sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  if (!latestArchivedState(projectAuthorityEntries(record.manager, limits), limits)) return;
  record.manager.appendCustomEntry(ARCHIVED_STATE_TYPE, { version: 1, sessionId: record.manager.getSessionId(), trashed: false });
}
