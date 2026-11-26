import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { settleUnknownSend } from "../messages/settle-unknown-send.ts";

/** The Gateway named the operation a send became: an unknown receipt is settled, a pending one is marked accepted. */
export function reconcileRequest(ctx: StoreContext, requestIdValue: string | undefined, operationId: string) {
  const receipt = requestIdValue ? ctx.state.session.localMessages.get(requestIdValue) : undefined;
  if (!requestIdValue || !receipt) return;
  if (receipt.status === "unknown") { settleUnknownSend(ctx, requestIdValue, "accepted"); return; }
  patchSession(ctx, { localMessages: mergeEntry(ctx.state.session.localMessages, requestIdValue, { status: "accepted", operationId }) });
}
