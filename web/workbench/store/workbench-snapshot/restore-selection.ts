import type { StoreContext } from "../store-context-types.ts";
import { viewQuery } from "../selection/view-query.ts";
import { selectSession } from "../selection/select-session.ts";
import { patch } from "../updates/patch.ts";
import { findSessionRow } from "../../payloads/find-session-row.ts";

/** After the first workbench base: select the session named by the URL, else the remembered one. */
export function restoreSelection(ctx: StoreContext) {
  const query = viewQuery();
  if (query && !findSessionRow(ctx.state, query.sessionId)) {
    patch(ctx, { service: "error", session: { ...ctx.state.session, error: "该会话不存在。" } });
    return;
  }
  const sessionId = query?.sessionId || ctx.storage.rememberedSession()?.sessionId;
  if (sessionId && findSessionRow(ctx.state, sessionId)) void selectSession(ctx, sessionId);
}
