import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { postJson } from "../requests/post-json.js";
import { patch } from "../updates/patch.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { replaceViewQuery } from "../selection/replace-view-query.js";
import { clearSessionState } from "../selection/clear-session-state.js";
import { setError } from "../notices/set-error.js";
export async function archiveSession(ctx) {
    const name = ctx.state.selectedSessionId;
    const sessionRow = name ? ctx.state.sessions.get(name) : null;
    if (!name || !sessionRow || ctx.state.session.pending.has("archiving")) return false;
    const requestToken = ctx.selectionToken;
    patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "archiving", true) });
    try {
      const result = await postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/archive`, { confirm: true });
      if (result?.ok !== true) throw new Error("移入归档未确认。");
      ctx.storage.forgetSession(name);
      const sessions = new Map([...ctx.state.sessions].filter(([key]) => key !== name));
      if (requestToken !== ctx.selectionToken || ctx.state.selectedSessionId !== name) {
        patch(ctx, { sessions });
        return true;
      }
      ++ctx.selectionToken;
      closeEventSource(ctx);
      replaceViewQuery(ctx, null);
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

