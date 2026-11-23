import { patchSession } from "../updates/patch-session.js";
import { mergeEntry } from "../updates/merge-entry.js";
export function reconcileRequest(ctx, requestIdValue, operationId) {
    if (!requestIdValue || !operationId || !ctx.state.session.localMessages.has(requestIdValue)) return;
    patchSession(ctx, { localMessages: mergeEntry(ctx, ctx.state.session.localMessages, requestIdValue, { status: "accepted", operationId }) });
  }

