import type { StoreContext } from "../store-context-types.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { postJson } from "../requests/post-json.ts";
import { patch } from "../updates/patch.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { setNotice } from "../notices/set-notice.ts";
import { setError } from "../notices/set-error.ts";
import { setBanner } from "../notices/set-banner.ts";

export async function renameSession(ctx: StoreContext, label: string): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  const sessionRow = name ? ctx.state.sessions.get(name) : null;
  if (!name || !sessionRow || ctx.state.session.pending.has("renaming") || !label.trim()) return false;
  const isCurrent = sessionRequestCurrent(ctx);
  patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "renaming", true) });
  try {
    const renamed = normalizeSession(await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/rename`, { label: label.trim() }));
    if (!renamed || renamed.sessionId !== name) throw new Error("重命名结果未确认。");
    if (!isCurrent() || ctx.state.selectedSessionId !== name) return false;
    patch(ctx, { sessions: mergeEntry(ctx.state.sessions, name, renamed) });
    setNotice(ctx, "会话名称已保存。", "notice");
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    setError(ctx, error instanceof Error ? error.message : "会话名称保存失败。");
    setBanner(ctx, "重命名结果未确认。", "error");
    return false;
  } finally { if (isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "renaming", false) }); }
}
