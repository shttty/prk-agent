import { nativeActionResult } from "./native-action-result.js";
import { safeText } from "../../payloads/safe-text.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { isRecord } from "../../payloads/is-record.js";
import { patch } from "../updates/patch.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { flushScroll } from "../drafts/flush-scroll.js";
import { setNotice } from "../notices/set-notice.js";
import { copyLiteral } from "../../../chat/clipboard/copy-literal.js";
import { normalizeSession } from "../../payloads/normalize-session.js";
import { selectSession } from "../selection/select-session.js";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.js";
import { loadNativeCatalog } from "./load-native-catalog.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { clearSessionState } from "../selection/clear-session-state.js";
import { replaceViewQuery } from "../selection/replace-view-query.js";
import { upsertNativeFeedback } from "./upsert-native-feedback.js";
import { setError } from "../notices/set-error.js";
import { addActivity } from "../notices/add-activity.js";
import { LIGHT_SETTING_ACTIONS, updateLightSetting } from "./update-light-setting.js";
export const QUIET_NOTICES = {
  reload: "已重新加载。",
  tree: "已回到这条消息之前。",
  clone: "已复制为新会话。",
};

export async function applyNativeActionResult(ctx, result, fallback, { transcript = true, preserveDraft = false } = {}) {
    const feedback = nativeActionResult(ctx, result)
      ? { ...result, requestId: safeText(result.requestId) || fallback.requestId, action: safeText(result.action) || fallback.action }
      : { ...fallback, status: "failed", message: fallback.message || "操作结果无效。" };
    const completed = feedback.status === "completed";
    const isCurrent = sessionRequestCurrent(ctx);
    const data = isRecord(feedback.data) ? feedback.data : {};
    if (completed && safeText(feedback.action) === "dequeue") {
      const messages = Array.isArray(data.messages) ? data.messages.map(safeText).filter(Boolean) : [];
      if (!messages.length && typeof data.text === "string") messages.push(data.text);
      patch(ctx, { draft: [ctx.state.draft, ...messages].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
      persistCurrentSession(ctx);
      setNotice(ctx, messages.length ? `已将 ${messages.length} 条排队消息移回输入框。` : "没有排队消息。", "notice");
    }
    if (completed && !preserveDraft && safeText(feedback.action) === "tree" && typeof data.editorText === "string") {
      patch(ctx, { draft: data.editorText, session: { ...ctx.state.session, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
      persistCurrentSession(ctx);
    }
    if (completed && typeof data.content === "string" && (data.download === true || typeof data.filename === "string")) {
      const blob = new Blob([data.content], { type: safeText(data.mimeType) || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeText(data.filename) || "pi-session-export.txt";
      anchor.rel = "noopener";
      anchor.click();
      URL.revokeObjectURL(url);
    }
    const clipboardText = safeText(feedback.action) === "tree-copy" && Array.isArray(data.tree)
      ? JSON.stringify(data.tree, null, 2)
      : typeof data.text === "string" ? data.text : typeof data.content === "string" ? data.content : "";
    if (completed && (safeText(feedback.action) === "copy" || safeText(feedback.action) === "tree-copy" || data.clipboard === true) && clipboardText) {
      const copied = await copyLiteral(clipboardText);
      if (!isCurrent()) return feedback;
      setNotice(ctx, copied ? "已复制原生内容。" : "复制失败，请手动复制。", copied ? "notice" : "error");
    }
    if (completed && safeText(feedback.action) === "settings" && typeof data.showImages?.requested === "boolean") {
      patch(ctx, { showImages: data.showImages.requested });
      setNotice(ctx, data.showImages.requested ? "已在浏览器中显示消息图片。" : "已在浏览器中隐藏消息图片。", "notice");
    }
    const managed = normalizeSession(data.session);
    if (completed && managed?.sessionId) {
      patch(ctx, { sessions: new Map(ctx.state.sessions).set(managed.sessionId, managed) });
      const shouldSelect = data.selected === true || managed.sessionId !== ctx.state.selectedSessionId;
      if (shouldSelect) {
        await selectSession(ctx, managed.sessionId, {
          ...(isRecord(data.snapshot) ? { snapshot: data.snapshot } : {}),
        });
      } else if (isRecord(data.snapshot)) {
        ingestSnapshot(ctx, data.snapshot);
        await loadNativeCatalog(ctx, managed.sessionId);
      }
      if (!isCurrent()) return feedback;
    }
    if (completed && LIGHT_SETTING_ACTIONS.has(feedback.action)) {
      updateLightSetting(ctx, Object.fromEntries(["model", "thinkingLevel", "toolMode", "delegation"].filter((field) => typeof data[field] === "string").map((field) => [field, data[field]])));
    }
    // Kernel language is not optimistic: only the server's answer moves the snapshot value.
    if (completed && feedback.action === "kernel-language" && ["python", "bun"].includes(data.language)) updateLightSetting(ctx, { kernelLanguage: data.language });
    if (completed && safeText(feedback.action) === "quit") {
      flushScroll(ctx);
      persistCurrentSession(ctx);
      ++ctx.selectionToken;
      closeEventSource(ctx);
      clearSessionState(ctx);
      replaceViewQuery(ctx, null);
      patch(ctx, { selectedSessionId: null });
    }
    if (!transcript && completed) {
      const action = safeText(feedback.action);
      const quiet = action === "export" ? `已导出 ${safeText(data.filename) || "会话文件"}。`
          : QUIET_NOTICES[action];
      if (quiet) setNotice(ctx, quiet, "notice");
    }
    if (transcript && !(feedback.action === "compact" && feedback.status === "running")) upsertNativeFeedback(ctx, feedback);
    else if (!["completed", "running"].includes(feedback.status)) setError(ctx, feedback.message || "原生操作失败。");
    addActivity(ctx, { title: `原生操作 · ${feedback.status}`, time: new Date().toISOString(), meta: feedback.message || feedback.action, tone: ["completed", "running"].includes(feedback.status) ? "" : "error" });
    return feedback;
  }

