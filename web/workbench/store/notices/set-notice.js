import { patchSession } from "../updates/patch-session.js";
export function setNotice(ctx, text, tone = "notice") {
    const notice = text ? { text: String(text), tone } : null;
    patchSession(ctx, { notice });
    clearTimeout(ctx.noticeTimer);
    // Plain info goes away by itself; warnings stay until closed.
    if (notice && tone === "notice") ctx.noticeTimer = setTimeout(() => { if (ctx.state.session.notice === notice) patchSession(ctx, { notice: null }); }, 6000);
  }

