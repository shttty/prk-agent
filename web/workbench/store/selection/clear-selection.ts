import type { StoreContext } from "../store-context-types.ts";
import type { SessionRow } from "../store-types.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { clearSessionState } from "./clear-session-state.ts";
import { replaceViewQuery } from "./replace-view-query.ts";
import { patch } from "../updates/patch.ts";

/** Drop the selected session (stream, chat state, view query) while installing the new sessionRow list. */
export function clearSelection(ctx: StoreContext, sessions: Map<string, SessionRow>) {
  ++ctx.selectionToken;
  closeEventSource(ctx);
  clearSessionState(ctx);
  replaceViewQuery(null);
  patch(ctx, { sessions, selectedSessionId: null, session: { ...ctx.state.session, snapshot: null, connection: "disconnected" } });
}
