import type { StoreContext } from "../store-context-types.ts";
import type { LocalMessage } from "../store-types.ts";
import type { ResolvedSendOptions, SendQueue } from "./message-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { setNotice } from "../notices/set-notice.ts";
import { hostState } from "../selection/host-state.ts";
import { requestId } from "../requests/request-id.ts";
import { RequestError } from "../requests/request-error.ts";
import { activeOperation } from "../selection/active-operation.ts";
import { patchSession } from "../updates/patch-session.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { postJson } from "../requests/post-json.ts";
import { nativeActionResult } from "../native-actions/native-action-result.ts";
import { applyNativeActionResult } from "../native-actions/apply-native-action-result.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { patch } from "../updates/patch.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { addActivity } from "../notices/add-activity.ts";
import { getJson } from "../requests/get-json.ts";
import { ingestSnapshot } from "../session-stream/ingest-snapshot.ts";
import { issueLabel } from "../../../instances/configuration-issue/issue-label.js";
import { confirmUnknownSends } from "./confirm-unknown-sends.ts";

const COMPLETED_OR_RUNNING = ["completed", "running"];
const REJECTED_HEADLINES = { wake: "会话唤醒失败，消息未发送。", runtime: "无法启动会话，消息未发送。", kernel: "无法恢复执行环境，消息未发送。" };

/** Post the message to the selected session and settle its composer receipt; resolves true when the Gateway took it. */
export async function admitMessage(ctx: StoreContext, message: string, queue: SendQueue, sendOptions: ResolvedSendOptions, matches: () => boolean, capturedDraft: number): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  if (!name) return false;
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
  const catalogAttachments = ctx.state.session.nativeCatalog.value?.attachments;
  const attachmentLimit = catalogAttachments?.maxItems ?? 4;
  const { attachments, references } = sendOptions;
  if (attachments.length > attachmentLimit || references.length > 32) {
    setNotice(ctx, `附件最多 ${attachmentLimit} 个、引用最多 32 个。`, "error");
    return false;
  }
  const mode = sendOptions.mode === "plain" ? "plain" : "auto";
  const payload = { requestId: id, message, mode, ...(attachments.length ? { attachments } : {}), ...(references.length ? { references } : {}), ...(busy ? { queue: queue === "followUp" ? "followUp" : "steer" } : {}) };
  const envelope = { v: 1, id: Number.MAX_SAFE_INTEGER, method: "send", params: { sessionId: name, ...payload } };
  const encodedPayloadBytes = new TextEncoder().encode(JSON.stringify(envelope)).byteLength + 1;
  const maxEncodedRequestBytes = catalogAttachments?.maxEncodedRequestBytes ?? 1_048_576;
  if (encodedPayloadBytes > maxEncodedRequestBytes) {
    setNotice(ctx, "消息加附件超过传输上限。", "error");
    return false;
  }
  // The stream this send went out on tells the Gateway whether its record can settle an unknown result.
  const local: LocalMessage = { status: "sending", text: message, streamId: ctx.state.session.streamId };
  patchSession(ctx, {
    localMessages: new Map(ctx.state.session.localMessages).set(id, local),
    transcriptRevision: ctx.state.session.transcriptRevision + 1,
  });
  persistCurrentSession(ctx);
  const isCurrent = sessionRequestCurrent(ctx);
  // What a delivered send clears: the composer copy, if the user has not changed it since.
  const clearedDraft = () => ({
    ...(ctx.draftRevision === capturedDraft && ctx.state.draft === message ? { draft: "" } : {}),
    ...(ctx.state.attachments === attachments ? { attachments: [] } : {}),
    ...(ctx.state.references === references ? { references: [] } : {}),
  });
  try {
    const result = await postJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}/send`, payload);
    if (nativeActionResult(result)) {
      if (!matches() || !isCurrent()) return COMPLETED_OR_RUNNING.includes(result.status);
      const feedback = await applyNativeActionResult(ctx, result, { requestId: id, action: "command" }, { preserveDraft: ctx.draftRevision !== capturedDraft });
      if (!matches() || !isCurrent()) return COMPLETED_OR_RUNNING.includes(feedback.status);
      const localMessages = new Map([...ctx.state.session.localMessages].filter(([key]) => key !== id));
      const done = feedback.status === "completed";
      const treeEditsDraft = feedback.action === "tree" && isRecord(feedback.data) && typeof feedback.data.editorText === "string";
      patch(ctx, {
        ...(done && ctx.draftRevision === capturedDraft && ctx.state.draft === message && !treeEditsDraft ? { draft: "" } : {}),
        ...(done && ctx.state.attachments === attachments ? { attachments: [] } : {}),
        ...(done && ctx.state.references === references ? { references: [] } : {}),
        session: { ...ctx.state.session, localMessages, transcriptRevision: ctx.state.session.transcriptRevision + 1 },
      });
      persistCurrentSession(ctx);
      if (!COMPLETED_OR_RUNNING.includes(feedback.status)) setNotice(ctx, feedback.message || `原生命令返回状态：${feedback.status}。`, feedback.status === "cancelled" ? "warning" : "error");
      return COMPLETED_OR_RUNNING.includes(feedback.status);
    }
    const reply: Record<string, unknown> = isRecord(result) ? result : {};
    const operationId = reply.accepted === true && typeof reply.operationId === "string" ? reply.operationId : null;
    if (!matches()) return operationId !== null;
    if (operationId) {
      // A wake can rotate the stream before the HTTP admission arrives. That reply still settles
      // this draft in the same selection, but only the current stream's events own operation state.
      if (!isCurrent()) {
        patch(ctx, clearedDraft());
        persistCurrentSession(ctx);
        return true;
      }
      const operations = mergeEntry(ctx.state.session.operations, operationId, { accepted: true });
      patch(ctx, { ...clearedDraft(), session: { ...ctx.state.session, localMessages: mergeEntry(ctx.state.session.localMessages, id, { status: "accepted", operationId }), operations, ...(ctx.state.session.banner?.kind === "send-rejected" ? { banner: null } : {}), transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
      addActivity(ctx, { title: "请求已接受 · 等待终态", time: new Date().toISOString(), meta: `${operationId} · ${id}`, tone: "notice" });
      persistCurrentSession(ctx);
      return true;
    }
    if (reply.plainSendAvailable === true) {
      patchSession(ctx, { localMessages: new Map([...ctx.state.session.localMessages].filter(([key]) => key !== id)), banner: { text: safeText(reply.error) || "未知命令；可作为普通文本发送。", tone: "warning", kind: "send-rejected", plainSendAvailable: true }, transcriptRevision: ctx.state.session.transcriptRevision + 1 });
      persistCurrentSession(ctx);
      return false;
    }
    patchSession(ctx, { localMessages: mergeEntry(ctx.state.session.localMessages, id, { status: "rejected" }), transcriptRevision: ctx.state.session.transcriptRevision + 1 });
    addActivity(ctx, { title: "请求被拒绝 · 未执行", time: new Date().toISOString(), meta: safeText(reply.error) || "服务拒绝了请求。", tone: "error" });
    setNotice(ctx, safeText(reply.error) || "请求被拒绝；草稿和来源已保留。", "error");
    persistCurrentSession(ctx);
    return false;
  } catch (error) {
    if (!matches()) return false;
    // request_accepted already reported this requestId on the current stream: only the reply was lost.
    if (isCurrent() && ctx.state.session.localMessages.get(id)?.operationId) {
      patch(ctx, clearedDraft());
      persistCurrentSession(ctx);
      return true;
    }
    // The Gateway refused before admitting the message (no runtime could be started, or the session could not
    // wake): it was definitely not sent. Say why; keep the draft.
    if (error instanceof RequestError && error.details?.submitted === false) {
      // An instance still missing its command or interpreter refuses with `details.configurationIssue`.
      const issue = isRecord(error.details.configurationIssue) ? error.details.configurationIssue : null;
      const reason = issue ? `${issueLabel(issue)}：补全实例设置后再发送。` : safeText(error.details.reason);
      const stage = error.details.stage === "wake" || error.details.stage === "runtime" ? error.details.stage : "kernel";
      // A failed environment deployment gets one sentence; its reason folds under the banner's details.
      const deployment = error.code === "DEPLOYMENT_FAILED";
      const headline = issue ? "消息未发送。" : deployment ? "环境准备失败，消息未发送。" : REJECTED_HEADLINES[stage];
      patchSession(ctx, {
        localMessages: mergeEntry(ctx.state.session.localMessages, id, { status: "rejected" }),
        banner: { text: reason && !deployment ? `${headline} ${reason}` : headline, tone: "error", kind: "send-rejected", stage, submitted: false,
          ...(issue && typeof issue.code === "string" ? { code: issue.code } : deployment && error.code ? { code: error.code, detail: reason } : {}) },
        transcriptRevision: ctx.state.session.transcriptRevision + 1,
      });
      // A failed start leaves the session unavailable; show that state instead of the stale one.
      if (stage !== "wake") void getJson(`${ctx.apiRoot}/sessions/${encodeURIComponent(name)}`).then((value) => { if (matches() && isCurrent()) ingestSnapshot(ctx, value); }, () => {});
      addActivity(ctx, { title: headline, time: new Date().toISOString(), meta: reason || error.message, tone: "error" });
      persistCurrentSession(ctx);
      return false;
    }
    // Reported once, by the composer status line (SendStatus); the Gateway's record of this requestId settles it.
    patchSession(ctx, {
      localMessages: new Map(ctx.state.session.localMessages).set(id, { ...local, status: "unknown" }),
      transcriptRevision: ctx.state.session.transcriptRevision + 1,
    });
    addActivity(ctx, { title: "发送结果未知 · 未自动重发", time: new Date().toISOString(), meta: error instanceof Error ? error.message : "连接失败", tone: "error" });
    persistCurrentSession(ctx);
    confirmUnknownSends(ctx);
    return false;
  }
}
