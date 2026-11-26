import { MAX_RECENT_OPERATIONS } from "../store-constants.js";
export function persistCurrentSession(ctx) {
    const sessionId = ctx.state.selectedSessionId;
    if (!sessionId) return;
    ctx.storage.persistSession(sessionId, {
      draft: ctx.state.draft,
      presentation: ctx.state.presentation,
      attachments: ctx.state.attachments,
      references: ctx.state.references,
      restoredQueueCounts: [...ctx.state.session.operations].filter(([, entry]) => entry.restoredQueueCount > 0)
        .slice(-MAX_RECENT_OPERATIONS).map(([operationId, entry]) => [operationId, entry.restoredQueueCount]),
      // Kept across reloads until the Gateway's record settles them; a reload alone proves nothing about delivery.
      unknownSends: [...ctx.state.session.localMessages].filter(([, entry]) => entry?.status === "unknown")
        .map(([requestId, entry]) => [requestId, { text: entry.text, streamId: entry.streamId, ...(entry.unconfirmable ? { unconfirmable: true } : {}) }]),
    });
  }

