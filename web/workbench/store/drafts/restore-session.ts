import type { StoreContext } from "../store-context-types.ts";
import { patch } from "../updates/patch.ts";
import { savedUnknownSends } from "../messages/saved-unknown-sends.ts";
import { restoredOperations } from "./restored-operations.ts";

export function restoreSession(ctx: StoreContext, sessionId: string) {
  const saved = ctx.storage.sessionState(sessionId);
  patch(ctx, {
    draft: saved.draft,
    attachments: saved.attachments,
    references: saved.references,
    presentation: saved.presentation,
    session: { ...ctx.state.session, operations: restoredOperations(saved.restoredQueueCounts), localMessages: savedUnknownSends(saved), presentationRevision: ctx.state.session.presentationRevision + 1 },
  });
}
