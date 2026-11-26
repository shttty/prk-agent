import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { isHostEvent } from "./is-host-event.ts";
import { ingestObservationSnapshot } from "./ingest-observation-snapshot.ts";
import { patchSession } from "../updates/patch-session.ts";
import { acceptExtensionUi } from "../extension-ui/accept-extension-ui.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { updateSessionRow } from "../workbench-snapshot/update-session-row.ts";
import { handleStateChanged } from "./handle-state-changed.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { reconcileRequest } from "./reconcile-request.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { addActivity } from "../notices/add-activity.ts";
import { printable } from "../../payloads/printable.ts";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.ts";
import { handleOperationCompletion } from "./handle-operation-completion.ts";
import { applyKernelTelemetry } from "./apply-kernel-telemetry.ts";
import { advanceRunStage } from "./advance-run-stage.ts";
import { readStateChange } from "./read-state-change.ts";
import { handleSessionEvent } from "./handle-session-event.ts";
import { appendLiveText } from "./append-live-text.ts";
import { settleUnknownSend } from "../messages/settle-unknown-send.ts";

/** One ordered event of the selected session's host stream; frames of another stream, session or an old sequence are dropped. */
export function handleHostEvent(ctx: StoreContext, value: unknown) {
  if (!isHostEvent(value)) return;
  const event = value;
  const details = event.details ?? {};
  if (event.type === "snapshot") { ingestObservationSnapshot(ctx, details.snapshot); return; }
  const snapshot: SessionHostSnapshot | null = ctx.state.session.snapshot;
  if (event.streamId !== ctx.state.session.streamId || !snapshot || event.sessionId !== snapshot.sessionId
    || event.sequence <= ctx.state.session.lastSequence) return;
  const sequence = event.sequence;
  // Kernel telemetry is ordered but does not invalidate plugin rendering.
  const change = event.type === "state_changed" ? readStateChange(event.details) : {};
  const kernelOnly = change.kernel !== undefined && change.state === undefined;
  // Telemetry alone reaches only the kernel readers, never a whole-App render.
  if (kernelOnly && !Object.hasOwn(change, "operation")) { applyKernelTelemetry(ctx, sequence, change); return; }
  patchSession(ctx, { lastSequence: sequence, ...(!kernelOnly && event.type !== "extension_ui" ? { snapshot: { ...snapshot, sequence } } : {}) },
    { displayOnly: ["message", "session_event", "extension_ui"].includes(event.type) });
  const runStage = advanceRunStage(ctx.state.session.runStage, event);
  if (runStage !== ctx.state.session.runStage) patchSession(ctx, { runStage }, { displayOnly: true });
  if (event.type === "extension_ui") {
    const extensionUi = isRecord(details.extensionUi) ? details.extensionUi : details;
    const prompts = Array.isArray(extensionUi.prompts) ? extensionUi.prompts : [];
    const previousPrompts = ctx.state.session.extensionUi?.prompts ?? [];
    const promptsChanged = prompts.length !== previousPrompts.length || prompts.some((prompt, index) => !isRecord(prompt) || prompt.id !== previousPrompts[index]?.id);
    // Opening/closing a dialog is interaction state, not a coalescible render invalidation.
    acceptExtensionUi(ctx, extensionUi, { displayOnly: !promptsChanged });
    return;
  }
  const message = isRecord(details.message) ? details.message : details;
  if (message.role === "custom" && message.customType === "gateway-internal-notification" && message.display === false) return;
  if (["message", "session_event", "request_accepted", "request_rejected", "operation_completed"].includes(event.type)) {
    patchSession(ctx, { transcriptRevision: ctx.state.session.transcriptRevision + 1 }, { displayOnly: event.type === "message" || event.type === "session_event" });
  }
  if (event.type === "message") appendLiveText(ctx, event);
  else if (event.type === "session_event") handleSessionEvent(ctx, event);
  else if (event.type === "state_changed") {
    handleStateChanged(ctx, event);
  } else if (event.type === "request_accepted") {
    const operationId = safeText(event.operationId);
    if (operationId) {
      const stale = ctx.state.session.banner?.operationId && ctx.state.session.banner.operationId !== operationId;
      patchSession(ctx, { operations: mergeEntry(ctx.state.session.operations, operationId, { accepted: true }), ...(stale ? { banner: null } : {}) });
      reconcileRequest(ctx, event.requestId, operationId);
      persistCurrentSession(ctx);
    }
  } else if (event.type === "request_rejected") {
    const requestIdValue = safeText(event.requestId);
    if (ctx.state.session.localMessages.get(requestIdValue)?.status === "unknown") settleUnknownSend(ctx, requestIdValue, "refused");
    else if (requestIdValue && ctx.state.session.localMessages.has(requestIdValue)) {
      patchSession(ctx, { localMessages: mergeEntry(ctx.state.session.localMessages, requestIdValue, { status: "rejected" }) });
    }
    addActivity(ctx, { title: "请求被拒绝", time: event.timestamp, meta: printable(event.details), tone: "error" });
    persistCurrentSession(ctx);
  } else if (event.type === "operation_cancel_requested") {
    const operationId = safeText(event.operationId);
    patchSession(ctx, { operations: mergeEntry(ctx.state.session.operations, operationId, { cancelRequested: true }) });
    restoreReturnedMessages(ctx, operationId, details.returnedMessages, event.sessionId);
    addActivity(ctx, { title: "已请求取消 · 尚未代表完成", time: event.timestamp, meta: operationId, tone: "notice" });
  } else if (event.type === "operation_completed") {
    handleOperationCompletion(ctx, event.details, event);
  } else if (event.type === "host_closed") {
    if (Number(details.failureCount) > 0) addActivity(ctx, { title: "会话已结束 · 资源清理未确认", time: event.timestamp, meta: printable(event.details), tone: "error" });
    const closing = ctx.state.session.snapshot;
    patchSession(ctx, { snapshot: closing ? { ...closing, state: "closed" } : closing });
    if (ctx.state.selectedSessionId) updateSessionRow(ctx, ctx.state.selectedSessionId, { state: "closed" });
    // Only the collection's final route-close event ends this observation.
    patchSession(ctx, { connection: "disconnected" });
  }
  persistCurrentSession(ctx);
}
