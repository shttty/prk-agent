import { isRecord } from "../../payloads/is-record.js";
import { setNotice } from "../notices/set-notice.js";
import { hostState } from "../selection/host-state.js";
import { requestId } from "../requests/request-id.js";
import { activeOperation } from "../selection/active-operation.js";
import { patchSession } from "../updates/patch-session.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { postJson } from "../requests/post-json.js";
import { nativeActionResult } from "../native-actions/native-action-result.js";
import { applyNativeActionResult } from "../native-actions/apply-native-action-result.js";
import { safeText } from "../../payloads/safe-text.js";
import { patch } from "../updates/patch.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { addActivity } from "../notices/add-activity.js";
import { getJson } from "../requests/get-json.js";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.js";
import { issueLabel } from "../../../instances/configuration-issue/issue-label.js";
export async function admitMessage(ctx, message, queueOrOptions, options, matches, capturedDraft) {
    const sendOptions = isRecord(queueOrOptions) ? queueOrOptions : options;
    const queue = typeof queueOrOptions === "string" ? queueOrOptions : sendOptions.queue || ctx.state.queue;
    const name = ctx.state.selectedSessionId;
    if (message.length > 262144) {
      setNotice(ctx, "超过单次发送上限，请分开发送。", "error");
      return false;
    }
    // Closed sessions resume on send.
    if (hostState(ctx) === "closing") {
      setNotice(ctx, "会话已结束，不能发送。", "warning");
      return false;
    }
    const id = requestId();
    const busy = Boolean(activeOperation(ctx)) || ["running", "cancel_requested"].includes(hostState(ctx));
    const attachmentLimit = Number.isSafeInteger(ctx.state.session.nativeCatalog.value?.attachments?.maxItems) ? ctx.state.session.nativeCatalog.value.attachments.maxItems : 4;
    const attachments = Array.isArray(sendOptions.attachments) ? sendOptions.attachments : ctx.state.attachments;
    const references = Array.isArray(sendOptions.references) ? sendOptions.references : ctx.state.references;
    if (attachments.length > attachmentLimit || references.length > 32) {
      setNotice(ctx, `附件最多 ${attachmentLimit} 个、引用最多 32 个。`, "error");
      return false;
    }
    const mode = sendOptions.mode === "plain" ? "plain" : "auto";
    const payload = { requestId: id, message, mode, ...(attachments.length ? { attachments } : {}), ...(references.length ? { references } : {}), ...(busy ? { queue: queue === "followUp" ? "followUp" : "steer" } : {}) };
    const envelope = { v: 1, id: Number.MAX_SAFE_INTEGER, method: "send", params: { sessionId: name, ...payload } };
    const encodedPayloadBytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength + 1;
    const maxEncodedRequestBytes = ctx.state.session.nativeCatalog.value?.attachments?.maxEncodedRequestBytes ?? 1_048_576;
    if (encodedPayloadBytes > maxEncodedRequestBytes) {
      setNotice(ctx, "消息加附件超过传输上限。", "error");
      return false;
    }
    const local = { status: "sending", text: message };
    patchSession(ctx, {
          localMessages: new Map(ctx.state.session.localMessages).set(id, local),
          transcriptRevision: ctx.state.session.transcriptRevision + 1,
        });
    persistCurrentSession(ctx);
    const isCurrent = sessionRequestCurrent(ctx);
    try {
      const result = await postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/send`, payload);
      if (nativeActionResult(ctx, result)) {
        if (!matches() || !isCurrent()) return ["completed", "running"].includes(result.status);
        const feedback = await applyNativeActionResult(ctx, result, { requestId: id, action: safeText(result.action) || "command" }, { preserveDraft: ctx.draftRevision !== capturedDraft });
        if (!matches() || !isCurrent()) return ["completed", "running"].includes(feedback.status);
        const localMessages = new Map([...ctx.state.session.localMessages].filter(([key]) => key !== id));
        patch(ctx, { ...(feedback.status === "completed" && ctx.draftRevision === capturedDraft && ctx.state.draft === message && !(safeText(feedback.action) === "tree" && typeof feedback.data?.editorText === "string") ? { draft: "" } : {}), ...(feedback.status === "completed" && ctx.state.attachments === attachments ? { attachments: [] } : {}), ...(feedback.status === "completed" && ctx.state.references === references ? { references: [] } : {}), session: { ...ctx.state.session, localMessages, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
        persistCurrentSession(ctx);
        if (!["completed", "running"].includes(feedback.status)) setNotice(ctx, feedback.message || `原生命令返回状态：${feedback.status}。`, feedback.status === "cancelled" ? "warning" : "error");
        return ["completed", "running"].includes(feedback.status);
      }
      const accepted = result?.accepted === true && typeof result.operationId === "string";
      if (!matches()) return accepted;
      if (accepted) {
        const clearedDraft = {
          ...(ctx.draftRevision === capturedDraft && ctx.state.draft === message ? { draft: "" } : {}),
          ...(ctx.state.attachments === attachments ? { attachments: [] } : {}),
          ...(ctx.state.references === references ? { references: [] } : {}),
        };
        // A wake can rotate the stream before the HTTP admission arrives. That reply still settles
        // this draft in the same selection, but only the current stream's events own operation state.
        if (!isCurrent()) {
          patch(ctx, clearedDraft);
          persistCurrentSession(ctx);
          return true;
        }
        const operations = mergeEntry(ctx, ctx.state.session.operations, result.operationId, { accepted: true });
        patch(ctx, { ...clearedDraft, session: { ...ctx.state.session, localMessages: mergeEntry(ctx, ctx.state.session.localMessages, id, { status: "accepted", operationId: result.operationId }), operations, ...(ctx.state.session.banner?.kind === "send-rejected" ? { banner: null } : {}), transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
        addActivity(ctx, { title: "请求已接受 · 等待终态", time: new Date().toISOString(), meta: `${result.operationId} · ${id}`, tone: "notice" });
        persistCurrentSession(ctx);
        return true;
      }
      if (result?.plainSendAvailable === true) {
        patchSession(ctx, { localMessages: new Map([...ctx.state.session.localMessages].filter(([key]) => key !== id)), banner: { text: safeText(result.error) || "未知命令；可作为普通文本发送。", tone: "warning", kind: "send-rejected", plainSendAvailable: true }, transcriptRevision: ctx.state.session.transcriptRevision + 1 });
        persistCurrentSession(ctx);
        return false;
      }
      patchSession(ctx, { localMessages: mergeEntry(ctx, ctx.state.session.localMessages, id, { status: "rejected" }), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
      addActivity(ctx, { title: "请求被拒绝 · 未执行", time: new Date().toISOString(), meta: safeText(result?.error) || "服务拒绝了请求。", tone: "error" });
      setNotice(ctx, safeText(result?.error) || "请求被拒绝；草稿和来源已保留。", "error");
      persistCurrentSession(ctx);
      return false;
    } catch (error) {
      if (!matches()) return false;
      if (isCurrent() && ctx.state.session.localMessages.get(id)?.operationId) return true;
      // The Gateway refused before admitting the message (no runtime could be started, or the session could not
      // wake): it was definitely not sent. Say why; keep the draft.
      if (error?.details?.submitted === false) {
        // An instance still missing its command or interpreter refuses with `details.configurationIssue`.
        const issue = isRecord(error.details.configurationIssue) ? error.details.configurationIssue : null;
        const reason = issue ? `${issueLabel(issue)}：补全实例设置后再发送。` : safeText(error.details.reason);
        const stage = ["wake", "runtime"].includes(error.details.stage) ? error.details.stage : "kernel";
        // A failed environment deployment gets one sentence; its reason folds under the banner's details.
        const deployment = error.code === "DEPLOYMENT_FAILED";
        const headline = issue ? "消息未发送。" : deployment ? "环境准备失败，消息未发送。" : { wake: "会话唤醒失败，消息未发送。", runtime: "无法启动会话，消息未发送。", kernel: "无法恢复执行环境，消息未发送。" }[stage];
        patchSession(ctx, {
                  localMessages: mergeEntry(ctx, ctx.state.session.localMessages, id, { status: "rejected" }),
                  banner: { text: reason && !deployment ? `${headline} ${reason}` : headline, tone: "error", kind: "send-rejected", stage, submitted: false,
                    ...(issue ? { code: issue.code } : deployment ? { code: error.code, detail: reason } : {}) },
                  transcriptRevision: ctx.state.session.transcriptRevision + 1,
                });
        // A failed start leaves the session unavailable; show that state instead of the stale one.
        if (stage !== "wake") void getJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(name)}`).then((value) => { if (matches() && isCurrent()) ingestSnapshot(ctx, value); }, () => {});
        addActivity(ctx, { title: headline, time: new Date().toISOString(), meta: reason || error.message, tone: "error" });
        persistCurrentSession(ctx);
        return false;
      }
      patchSession(ctx, {
              localMessages: mergeEntry(ctx, ctx.state.session.localMessages, id, { status: "unknown" }),
              banner: { text: "发送结果未知，确认后再决定是否重发。", tone: "error" },
              transcriptRevision: ctx.state.session.transcriptRevision + 1,
            });
      addActivity(ctx, { title: "发送结果未知 · 未自动重发", time: new Date().toISOString(), meta: error instanceof Error ? error.message : "连接失败", tone: "error" });
      persistCurrentSession(ctx);
      return false;
    }
  }

