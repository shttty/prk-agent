import { patch } from "../updates/patch.js";
export function restoreSession(ctx, sessionId) {
    const saved = ctx.storage.sessionState(sessionId);
    patch(ctx, { draft: saved?.draft || "", attachments: saved?.attachments || [], references: saved?.references || [], presentation: saved?.presentation || null, session: { ...ctx.state.session, operations: new Map((saved?.restoredQueueCounts || []).map(([operationId, restoredQueueCount]) => [operationId, { restoredQueueCount }])), presentationRevision: ctx.state.session.presentationRevision + 1 } });
  }

