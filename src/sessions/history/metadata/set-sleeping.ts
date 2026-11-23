import type { HistoryContext } from "../history-types.ts";
import { getRecord } from "../catalog/find-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { latestSleeping } from "./read-sleep-state.ts";
import { projectAuthorityEntries } from "../format-authority-entries.ts";
import { SESSION_SLEEP_TYPE } from "../history-protocol.ts";

export function setSleeping(ctx: HistoryContext, sessionId: string, sleeping: boolean): void {
  const { limits } = ctx;
  const record = getRecord(ctx, sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  if (latestSleeping(projectAuthorityEntries(record.manager, limits), limits) === sleeping) return;
  record.manager.appendCustomEntry(SESSION_SLEEP_TYPE, {
    version: 1, sessionId: record.manager.getSessionId(), sleeping,
  });
}
