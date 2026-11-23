import { closeWorkbenchEventSource } from "../workbench-snapshot/close-workbench-event-source.js";
import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.js";
import { hostState } from "../selection/host-state.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { closeEventSource } from "./close-event-source.js";
import { openEventSource } from "./open-event-source.js";
/** Reopen only streams that actually ended; a reopened subscription's first snapshot is the new base. */
export async function reconnect(ctx) {
    if (ctx.disposed) return false;
    if (!ctx.workbenchSource || ctx.workbenchSource.readyState === 2) {
      closeWorkbenchEventSource(ctx);
      openWorkbenchEventSource(ctx);
    }
    const name = ctx.state.selectedSessionId;
    if (!name || (hostState(ctx) === "closed" && ctx.state.sessions.get(name)?.state === "closed")) return false;
    if (ctx.source && ctx.source.readyState !== 2) return true;
    closeEventSource(ctx);
    patchSession(ctx, { error: null, connection: "connecting", pending: withPending(ctx.state.session.pending, "reconnecting", true) });
    openEventSource(ctx, name, ctx.selectionToken);
    return true;
  }
