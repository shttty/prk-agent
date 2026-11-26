import type { StoreContext } from "../store-context-types.ts";
import type { NativeFeedback } from "../store-types.ts";
import type { NativeFallback } from "./native-action-types.ts";
import { nativeActionResult } from "./native-action-result.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { patch } from "../updates/patch.ts";
import { setShowImages } from "../set-show-images.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { flushScroll } from "../drafts/flush-scroll.ts";
import { setNotice } from "../notices/set-notice.ts";
import { copyLiteral } from "../../../chat/clipboard/copy-literal.js";
import { normalizeSession } from "../../payloads/normalize-session.ts";
import { selectSession } from "../selection/select-session.ts";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.ts";
import { loadNativeCatalog } from "./load-native-catalog.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { clearSessionState } from "../selection/clear-session-state.ts";
import { replaceViewQuery } from "../selection/replace-view-query.ts";
import { upsertNativeFeedback } from "./upsert-native-feedback.ts";
import { setError } from "../notices/set-error.ts";
import { addActivity } from "../notices/add-activity.ts";
import { lightSettingChanges } from "./light-setting-changes.ts";
import { LIGHT_SETTINGS, updateLightSetting } from "./update-light-setting.ts";

export const QUIET_NOTICES: Record<string, string> = {
  reload: "已重新加载。",
  tree: "已回到这条消息之前。",
  clone: "已复制为新会话。",
};

/** Show a native action's outcome: the transcript feedback and every page effect its `data` asks for. */
export async function applyNativeActionResult(ctx: StoreContext, result: unknown, fallback: NativeFallback, { transcript = true, preserveDraft = false }: { transcript?: boolean; preserveDraft?: boolean } = {}): Promise<NativeFeedback> {
  const feedback: NativeFeedback = nativeActionResult(result)
    ? { ...result, requestId: safeText(result.requestId) || fallback.requestId, action: safeText(result.action) || fallback.action }
    : { ...fallback, status: "failed", message: fallback.message || "操作结果无效。" };
  const completed = feedback.status === "completed";
  const isCurrent = sessionRequestCurrent(ctx);
  const data = isRecord(feedback.data) ? feedback.data : {};
  if (completed && feedback.action === "dequeue") {
    const messages = Array.isArray(data.messages) ? data.messages.map(safeText).filter(Boolean) : [];
    if (!messages.length && typeof data.text === "string") messages.push(data.text);
    patch(ctx, { draft: [ctx.state.draft, ...messages].filter(Boolean).join("\n\n"), session: { ...ctx.state.session, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
    persistCurrentSession(ctx);
    setNotice(ctx, messages.length ? `已将 ${messages.length} 条排队消息移回输入框。` : "没有排队消息。", "notice");
  }
  if (completed && !preserveDraft && feedback.action === "tree" && typeof data.editorText === "string") {
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
  const clipboardText = feedback.action === "tree-copy" && Array.isArray(data.tree)
    ? JSON.stringify(data.tree, null, 2)
    : typeof data.text === "string" ? data.text : typeof data.content === "string" ? data.content : "";
  if (completed && (feedback.action === "copy" || feedback.action === "tree-copy" || data.clipboard === true) && clipboardText) {
    const copied = await copyLiteral(clipboardText);
    if (!isCurrent()) return feedback;
    setNotice(ctx, copied ? "已复制原生内容。" : "复制失败，请手动复制。", copied ? "notice" : "error");
  }
  if (completed && feedback.action === "settings" && isRecord(data.showImages) && typeof data.showImages.requested === "boolean") {
    setShowImages(ctx, data.showImages.requested);
    setNotice(ctx, data.showImages.requested ? "已在浏览器中显示消息图片。" : "已在浏览器中隐藏消息图片。", "notice");
  }
  const managed = normalizeSession(data.session);
  if (completed && managed) {
    patch(ctx, { sessions: new Map(ctx.state.sessions).set(managed.sessionId, managed) });
    const shouldSelect = data.selected === true || managed.sessionId !== ctx.state.selectedSessionId;
    if (shouldSelect) {
      await selectSession(ctx, managed.sessionId, isRecord(data.snapshot) ? { snapshot: data.snapshot } : {});
    } else if (isRecord(data.snapshot)) {
      ingestSnapshot(ctx, data.snapshot);
      await loadNativeCatalog(ctx, managed.sessionId);
    }
    if (!isCurrent()) return feedback;
  }
  if (completed && Object.hasOwn(LIGHT_SETTINGS, feedback.action)) updateLightSetting(ctx, lightSettingChanges(data));
  // Kernel language is not optimistic: only the server's answer moves the snapshot value.
  if (completed && feedback.action === "kernel-language" && (data.language === "python" || data.language === "bun")) updateLightSetting(ctx, { kernelLanguage: data.language });
  if (completed && feedback.action === "quit") {
    flushScroll(ctx);
    persistCurrentSession(ctx);
    ++ctx.selectionToken;
    closeEventSource(ctx);
    clearSessionState(ctx);
    replaceViewQuery(null);
    patch(ctx, { selectedSessionId: null });
  }
  if (!transcript && completed) {
    const quiet = feedback.action === "export" ? `已导出 ${safeText(data.filename) || "会话文件"}。` : QUIET_NOTICES[feedback.action];
    if (quiet) setNotice(ctx, quiet, "notice");
  }
  if (transcript && !(feedback.action === "compact" && feedback.status === "running")) upsertNativeFeedback(ctx, feedback);
  else if (!["completed", "running"].includes(feedback.status)) setError(ctx, feedback.message || "原生操作失败。");
  addActivity(ctx, { title: `原生操作 · ${feedback.status}`, time: new Date().toISOString(), meta: feedback.message || feedback.action, tone: ["completed", "running"].includes(feedback.status) ? "" : "error" });
  return feedback;
}
