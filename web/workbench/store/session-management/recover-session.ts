import type { StoreContext } from "../store-context-types.ts";
import type { RecoverySelection } from "./session-management-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { postJson } from "../requests/post-json.ts";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.ts";
import { patch } from "../updates/patch.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { selectSession } from "../selection/select-session.ts";
import { setBanner } from "../notices/set-banner.ts";
import { setNotice } from "../notices/set-notice.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { issueLabel } from "../../../instances/configuration-issue/issue-label.js";

export async function recoverSession(ctx: StoreContext, mode: "new" | "auto", selection?: RecoverySelection): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  const sessionRow = name ? ctx.state.sessions.get(name) : null;
  if (!name || !sessionRow || !["closed", "sleeping", "unavailable"].includes(sessionRow.state) || ctx.state.session.pending.has("recovering")) return false;
  if (selection && (mode !== "new" || !selection.target)) return false;
  patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "recovering", true) });
  const stage = sessionRow.state === "sleeping" ? "wake" : "kernel";
  try {
    const value = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/recover`, {
      mode,
      ...(selection ? { target: selection.target, ...(selection.cwd ? { cwd: selection.cwd } : {}) } : {}),
    });
    const restored = isRecord(value) ? normalizeSession(value.session) : null;
    const snapshot = isRecord(value) ? normalizeSnapshot(value.snapshot) : null;
    const recovery = restored?.recovery;
    if (!restored || !snapshot || !recovery || restored.sessionId !== name || (recovery.status !== "unavailable" && recovery.status !== "new")) {
      throw new Error("恢复结果未确认，请刷新。");
    }
    if (ctx.state.selectedSessionId !== name) return false;
    patch(ctx, { sessions: mergeEntry(ctx.state.sessions, name, restored), session: { ...ctx.state.session, pending: withPending(ctx.state.session.pending, "recovering", false) } });
    await selectSession(ctx, name, { snapshot });
    // A move to an instance that still needs settings is saved and the session stays asleep: done, not a failure.
    const issue = restored.configurationIssue;
    if (selection && issue) {
      patchSession(ctx, { recoveryMessage: "" });
      setNotice(ctx, `已换到新的执行环境；${issueLabel(issue)}，补全实例设置后才能执行。`, "notice");
      return true;
    }
    if (recovery.status === "unavailable") {
      const detail = issue ? `${issueLabel(issue)}，补全实例设置后才能执行。` : recovery.message;
      patchSession(ctx, { recoveryMessage: detail });
      setBanner(ctx, `${selection ? "无法在新的执行环境中启动" : "无法恢复执行环境"}。${detail ? ` ${detail}` : ""}`, "error", { kind: "recovery", stage, code: issue?.code ?? recovery.code });
      return false;
    }
    patchSession(ctx, { recoveryMessage: "" });
    return true;
  } catch (error) {
    if (ctx.state.selectedSessionId === name) {
      patchSession(ctx, { error: error instanceof Error ? error.message : "会话恢复结果未确认。", banner: { text: "恢复结果未确认，请刷新。", tone: "warning", kind: "recovery", stage }, pending: withPending(ctx.state.session.pending, "recovering", false) });
    }
    return false;
  } finally { if (ctx.state.session.pending.has("recovering")) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "recovering", false) }); }
}
