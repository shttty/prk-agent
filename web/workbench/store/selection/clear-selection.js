import { closeEventSource } from "../session-stream/close-event-source.js";
import { clearSessionState } from "./clear-session-state.js";
import { replaceViewQuery } from "./replace-view-query.js";
import { patch } from "../updates/patch.js";
/** Drop the selected session (stream, chat state, view query) while installing the new sessionRow list. */
export function clearSelection(ctx, sessions) {
  ++ctx.selectionToken;
  closeEventSource(ctx);
  clearSessionState(ctx);
  replaceViewQuery(ctx, null);
  patch(ctx, { sessions, selectedSessionId: null, session: { ...ctx.state.session, snapshot: null, connection: "disconnected" } });
}
