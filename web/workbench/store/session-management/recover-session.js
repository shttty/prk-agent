import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { postJson } from "../requests/post-json.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.js";
import { patch } from "../updates/patch.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { selectSession } from "../selection/select-session.js";
import { setBanner } from "../notices/set-banner.js";
import { setNotice } from "../notices/set-notice.js";
import { isRecord } from "../../payloads/is-record.js";
import { issueLabel } from "../../../instances/configuration-issue/issue-label.js";
export async function recoverSession(ctx, mode, selection) {
    const name = ctx.state.selectedSessionId;
    const sessionRow = name ? ctx.state.sessions.get(name) : null;
    if (!name || !sessionRow || !["closed", "sleeping", "unavailable"].includes(sessionRow.state) || !["new", "auto"].includes(mode) || ctx.state.session.pending.has("recovering")) return false;
    if (selection && (mode !== "new" || !selection.target)) return false;
    patchSession(ctx, { error: null, pending: withPending(ctx.state.session.pending, "recovering", true) });
    try {
      const value = await postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/recover`, {
        mode,
        ...(selection ? { target: selection.target, ...(selection.cwd ? { cwd: selection.cwd } : {}) } : {}),
      });
      const restored = normalizeSession(value?.session);
      const snapshot = normalizeSnapshot(value?.snapshot);
      if (!restored || !snapshot || restored.sessionId !== name
        || !["unavailable", "new"].includes(restored.recovery?.status)) {
        throw new Error("恢复结果未确认，请刷新。");
      }
      if (!(ctx.state.selectedSessionId === name)) return false;
      patch(ctx, { sessions: mergeEntry(ctx, ctx.state.sessions, name, restored), session: { ...ctx.state.session, pending: withPending(ctx.state.session.pending, "recovering", false) } });
      await selectSession(ctx, name, { snapshot });
      // A move to an instance that still needs settings is saved and the session stays asleep: done, not a failure.
      const issue = isRecord(restored.configurationIssue) ? restored.configurationIssue : null;
      if (selection && issue) {
        patchSession(ctx, { recoveryMessage: "" });
        setNotice(ctx, `已换到新的执行环境；${issueLabel(issue)}，补全实例设置后才能执行。`, "notice");
        return true;
      }
      if (restored.recovery?.status === "unavailable") {
        const detail = issue ? `${issueLabel(issue)}，补全实例设置后才能执行。` : typeof restored.recovery.message === "string" ? restored.recovery.message : "";
        patchSession(ctx, { recoveryMessage: detail });
        setBanner(ctx, `${selection ? "无法在新的执行环境中启动" : "无法恢复执行环境"}。${detail ? ` ${detail}` : ""}`, "error", { kind: "recovery", stage: sessionRow.state === "sleeping" ? "wake" : "kernel", code: issue?.code ?? restored.recovery.code });
        return false;
      }
      patchSession(ctx, { recoveryMessage: "" });
      return true;
    } catch (error) {
      if ((ctx.state.selectedSessionId === name)) {
        patchSession(ctx, { error: error instanceof Error ? error.message : "会话恢复结果未确认。", banner: { text: "恢复结果未确认，请刷新。", tone: "warning", kind: "recovery", stage: sessionRow.state === "sleeping" ? "wake" : "kernel" }, pending: withPending(ctx.state.session.pending, "recovering", false) });
      }
      return false;
    } finally { if (ctx.state.session.pending.has("recovering")) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "recovering", false) }); }
  }

