import type { StoreContext } from "../store-context-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { ingestSnapshot } from "./ingest-snapshot.ts";
import { refreshHistory } from "./refresh-history.ts";

/** An observation snapshot carries state but no history: it is laid over the history the page already holds, then the Gateway's newer entries are read. */
export function ingestObservationSnapshot(ctx: StoreContext, value: unknown) {
  if (!isRecord(value) || value.sessionId !== ctx.state.selectedSessionId) return;
  const through = value.historyThrough;
  if (through !== null && typeof through !== "string") return;
  const held = ctx.state.session.snapshot;
  const merged = {
    ...value,
    messages: held?.messages ?? [],
    messageEntryIds: held?.messageEntryIds ?? [],
    historyBefore: held?.historyBefore,
    historyForkBefore: held?.historyForkBefore,
    compactions: held?.compactions,
    compactionEntryIds: held?.compactionEntryIds,
    historyThrough: held?.historyThrough,
  };
  if (ingestSnapshot(ctx, merged, true)) void refreshHistory(ctx, through);
}
