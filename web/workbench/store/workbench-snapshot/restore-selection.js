import { viewQuery } from "../selection/view-query.js";
import { selectSession } from "../selection/select-session.js";
import { patch } from "../updates/patch.js";
import { findSessionRow } from "../../payloads/find-session-row.js";
/** After the first workbench base: select the session named by the URL, else the remembered one. */
export function restoreSelection(ctx) {
  const query = viewQuery(ctx);
  if (query && !findSessionRow(ctx.state, query.sessionId)) {
    patch(ctx, { service: "error", session: { ...ctx.state.session, error: "该会话不存在。" } });
    return;
  }
  const sessionId = query?.sessionId || ctx.storage.rememberedSession()?.sessionId;
  if (sessionId && findSessionRow(ctx.state, sessionId)) void selectSession(ctx, sessionId);
}
