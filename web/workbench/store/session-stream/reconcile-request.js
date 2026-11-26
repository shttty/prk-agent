import { patchSession } from "../updates/patch-session.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { settleUnknownSend } from "../messages/settle-unknown-send.js";
export function reconcileRequest(ctx, requestIdValue, operationId) {
    if (!requestIdValue || !operationId || !ctx.state.session.localMessages.has(requestIdValue)) return;
    if (ctx.state.session.localMessages.get(requestIdValue).status === "unknown") { settleUnknownSend(ctx, requestIdValue, { status: "accepted" }); return; }
    patchSession(ctx, { localMessages: mergeEntry(ctx, ctx.state.session.localMessages, requestIdValue, { status: "accepted", operationId }) });
  }

