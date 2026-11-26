import type { StoreContext } from "../store-context-types.ts";
import type { Tone } from "../store-types.ts";
import { patchSession } from "../updates/patch-session.ts";

export function setNotice(ctx: StoreContext, text: string | null, tone: Tone = "notice") {
  const notice = text ? { text, tone } : null;
  patchSession(ctx, { notice });
  clearTimeout(ctx.noticeTimer);
  // Plain info goes away by itself; warnings stay until closed.
  if (notice && tone === "notice") ctx.noticeTimer = setTimeout(() => { if (ctx.state.session.notice === notice) patchSession(ctx, { notice: null }); }, 6000);
}
