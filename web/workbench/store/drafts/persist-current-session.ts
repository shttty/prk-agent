import type { StoreContext } from "../store-context-types.ts";
import type { RestoredQueueCount, UnknownSendEntry } from "../../session-storage/session-storage-types.ts";
import { MAX_RECENT_OPERATIONS } from "../store-constants.ts";

export function persistCurrentSession(ctx: StoreContext) {
  const sessionId = ctx.state.selectedSessionId;
  if (!sessionId) return;
  const restoredQueueCounts: RestoredQueueCount[] = [];
  for (const [operationId, { restoredQueueCount = 0 }] of ctx.state.session.operations) {
    if (restoredQueueCount > 0) restoredQueueCounts.push([operationId, restoredQueueCount]);
  }
  // Kept across reloads until the Gateway's record settles them; a reload alone proves nothing about delivery.
  const unknownSends: UnknownSendEntry[] = [];
  for (const [requestId, { status, text, streamId, unconfirmable }] of ctx.state.session.localMessages) {
    if (status === "unknown" && streamId !== null) unknownSends.push([requestId, { text, streamId, ...(unconfirmable ? { unconfirmable } : {}) }]);
  }
  ctx.storage.persistSession(sessionId, {
    draft: ctx.state.draft,
    presentation: ctx.state.presentation,
    attachments: ctx.state.attachments,
    references: ctx.state.references,
    restoredQueueCounts: restoredQueueCounts.slice(-MAX_RECENT_OPERATIONS),
    unknownSends,
  });
}
