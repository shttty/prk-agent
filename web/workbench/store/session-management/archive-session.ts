import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { postJson } from "../requests/post-json.ts";
import { patch } from "../updates/patch.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { replaceViewQuery } from "../selection/replace-view-query.ts";
import { clearSessionState } from "../selection/clear-session-state.ts";
import { setError } from "../notices/set-error.ts";
import { isOkReply } from "../../payloads/is-ok-reply.ts";

export async function archiveSession(ctx: StoreContext): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  const sessionRow = name ? ctx.state.sessions.get(name) : null;
  if (!name || !sessionRow || ctx.state.session.pending.has("archiving")) return false;
  const requestToken = ctx.selectionToken;
  patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "archiving", true) });
  try {
    const result = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/archive`, { confirm: true });
    if (!isOkReply(result)) throw new Error("移入归档未确认。");
    ctx.storage.forgetSession(name);
    const sessions = new Map([...ctx.state.sessions].filter(([key]) => key !== name));
    if (requestToken !== ctx.selectionToken || ctx.state.selectedSessionId !== name) {
      patch(ctx, { sessions });
      return true;
    }
    ++ctx.selectionToken;
    closeEventSource(ctx);
    replaceViewQuery(null);
    clearSessionState(ctx);
    patch(ctx, { sessions, selectedSessionId: null });
    return true;
  } catch (error) {
    if (requestToken === ctx.selectionToken) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "archiving", false) });
    if (requestToken === ctx.selectionToken && ctx.state.selectedSessionId === name) {
      setError(ctx, error instanceof Error ? error.message : "归档结果未确认。");
    }
    return false;
  }
}
