import { isRecord } from "../../payloads/is-record.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { postJson } from "../requests/post-json.js";
import { setNotice } from "../notices/set-notice.js";
import { setError } from "../notices/set-error.js";
import { setBanner } from "../notices/set-banner.js";
export async function manageSession(ctx, request) {
    const name = ctx.state.selectedSessionId;
    const sessionRow = name ? ctx.state.sessions.get(name) : null;
    if (!name || !sessionRow?.derivation || ctx.state.session.pending.has("sessionManaging") || !isRecord(request) || typeof request.action !== "string") return false;
    const isCurrent = sessionRequestCurrent(ctx);
    patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "sessionManaging", true) });
    try {
      const body = await postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/manage`, request);
      if (body?.ok !== true) throw new Error("派生会话管理操作未确认。");
      if (isCurrent()) setNotice(ctx, "派生会话管理操作已确认。", "notice");
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      setError(ctx, error instanceof Error ? error.message : "派生会话管理操作未确认。 ");
      setBanner(ctx, "操作结果未确认，请刷新。", "error");
      return false;
    } finally { if (isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "sessionManaging", false) }); }
  }

