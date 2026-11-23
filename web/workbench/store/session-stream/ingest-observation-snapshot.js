import { isRecord } from "../../payloads/is-record.js";
import { ingestSnapshot } from "./ingest-snapshot.js";
import { refreshHistory } from "./refresh-history.js";

export function ingestObservationSnapshot(ctx, value) {
  if (!isRecord(value) || value.sessionId !== ctx.state.selectedSessionId
    || !(value.historyThrough === null || typeof value.historyThrough === "string")) return;
  const { messages = [], messageEntryIds = [], historyBefore, historyForkBefore, compactions, compactionEntryIds, historyThrough } = ctx.state.session.snapshot || {};
  if (ingestSnapshot(ctx, { ...value, messages, messageEntryIds, historyBefore, historyForkBefore, compactions, compactionEntryIds, historyThrough }, true)) {
    void refreshHistory(ctx, value.historyThrough);
  }
}
