import type { StoreContext } from "../store-context-types.ts";
import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.ts";
import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.ts";
import { hostState } from "../selection/host-state.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { closeEventSource } from "./close-event-source.ts";
import { openEventSource } from "./open-event-source.ts";

/** Reopen only streams that actually ended; a reopened subscription's first snapshot is the new base. */
export async function reconnect(ctx: StoreContext): Promise<boolean> {
  if (ctx.disposed) return false;
  if (!ctx.workbenchSource || ctx.workbenchSource.readyState === EventSource.CLOSED) {
    closeWorkbenchEventSource(ctx);
    openWorkbenchEventSource(ctx);
  }
  const name = ctx.state.selectedSessionId;
  if (!name || (hostState(ctx) === "closed" && ctx.state.sessions.get(name)?.state === "closed")) return false;
  if (ctx.source && ctx.source.readyState !== EventSource.CLOSED) return true;
  closeEventSource(ctx);
  patchSession(ctx, { error: null, connection: "connecting", pending: withPending(ctx.state.session.pending, "reconnecting", true) });
  openEventSource(ctx, name, ctx.selectionToken);
  return true;
}
