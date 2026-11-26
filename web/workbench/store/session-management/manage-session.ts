import type { StoreContext } from "../store-context-types.ts";
import type { ManageSessionRequest } from "./session-management-types.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { postJson } from "../requests/post-json.ts";
import { setNotice } from "../notices/set-notice.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";
import { isOkReply } from "../../payloads/is-ok-reply.ts";

export async function manageSession(ctx: StoreContext, request: ManageSessionRequest): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  const sessionRow = name ? ctx.state.sessions.get(name) : null;
  if (!name || !sessionRow?.derivation || ctx.state.session.pending.has("sessionManaging")) return false;
  const isCurrent = sessionRequestCurrent(ctx);
  patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "sessionManaging", true) });
  try {
    const body = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/manage`, request);
    if (!isOkReply(body)) throw new Error("派生会话管理操作未确认。");
    if (isCurrent()) setNotice(ctx, "派生会话管理操作已确认。", "notice");
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    setError(ctx, error instanceof Error ? error.message : "派生会话管理操作未确认。 ");
    setBanner(ctx, "操作结果未确认，请刷新。", "error");
    return false;
  } finally { if (isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "sessionManaging", false) }); }
}
