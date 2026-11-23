import { isRecord } from "../../payloads/is-record.js";
import { ingestObservationSnapshot } from "./ingest-observation-snapshot.js";
import { patchSession } from "../updates/patch-session.js";
import { acceptExtensionUi } from "../extension-ui/accept-extension-ui.js";
import { safeText } from "../../payloads/safe-text.js";
import { ingestToolEvent } from "../../payloads/tool-runs/ingest-tool-event.js";
import { updateSessionRow } from "../workbench-snapshot/update-session-row.js";
import { handleStateChanged } from "./handle-state-changed.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { reconcileRequest } from "./reconcile-request.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { addActivity } from "../notices/add-activity.js";
import { printable } from "../../payloads/printable.js";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.js";
import { handleOperationCompletion } from "./handle-operation-completion.js";
import { setBanner } from "../notices/set-banner.js";
import { applyKernelTelemetry } from "./apply-kernel-telemetry.js";
import { advanceRunStage } from "./advance-run-stage.js";
export function handleHostEvent(ctx, event) {
    if (!isRecord(event) || typeof event.type !== "string" || typeof event.streamId !== "string" || !event.streamId
      || !Number.isSafeInteger(event.sequence)) return;
    if (event.type === "snapshot") { ingestObservationSnapshot(ctx, event.details?.snapshot); return; }
    if (event.streamId !== ctx.state.session.streamId || event.sessionId !== ctx.state.session.snapshot?.sessionId
      || event.sequence <= ctx.state.session.lastSequence) return;
    const sequence = event.sequence;
    // Kernel telemetry is ordered but does not invalidate plugin rendering.
    const kernelOnly = event.type === "state_changed" && isRecord(event.details?.kernel) && typeof event.details.state !== "string";
    // Telemetry alone reaches only the kernel readers, never a whole-App render.
    if (kernelOnly && !Object.hasOwn(event.details, "operation")) { applyKernelTelemetry(ctx, event); return; }
    patchSession(ctx, { lastSequence: sequence, ...(!kernelOnly && event.type !== "extension_ui" ? { snapshot: { ...ctx.state.session.snapshot, sequence } } : {}) },
          { displayOnly: ["message", "session_event", "extension_ui"].includes(event.type) });
    const runStage = advanceRunStage(ctx.state.session.runStage, event);
    if (runStage !== ctx.state.session.runStage) patchSession(ctx, { runStage }, { displayOnly: true });
    if (event.type === "extension_ui") {
      const extensionUi = isRecord(event.details?.extensionUi) ? event.details.extensionUi : event.details;
      const prompts = extensionUi?.prompts || [];
      const previousPrompts = ctx.state.session.extensionUi?.prompts || [];
      const promptsChanged = prompts.length !== previousPrompts.length || prompts.some((prompt, index) => prompt.id !== previousPrompts[index]?.id);
      // Opening/closing a dialog is interaction state, not a coalescible render invalidation.
      acceptExtensionUi(ctx, extensionUi, { displayOnly: !promptsChanged });
      return;
    }
    const message = event.details?.message || event.message || event.details;
    if (message?.role === "custom" && message.customType === "gateway-internal-notification" && message.display === false) return;
    if (["message", "session_event", "request_accepted", "request_rejected", "operation_completed"].includes(event.type)) {
      patchSession(ctx, { transcriptRevision: ctx.state.session.transcriptRevision + 1 }, { displayOnly: event.type === "message" || event.type === "session_event" });
    }
    if (event.type === "message") {
      // Display-only ordering: a new segment starts whenever tool runs of the same operation began since the
      // previous delta, the delta switches between reply text and thinking, or a new thinking block begins, so live
      // text, thinking and tool rows interleave in arrival order until the authoritative snapshot replaces them.
      const operationId = safeText(event.operationId) || "live";
      const toolsSoFar = [...ctx.state.session.toolRuns.values()].filter((run) => (safeText(run?.operationId) || "live") === operationId).length;
      const segments = ctx.state.session.streams.get(operationId) || [];
      const last = segments[segments.length - 1];
      const text = safeText(event.text);
      const thinking = event.details?.part === "thinking";
      const kind = thinking ? { part: "thinking", contentIndex: Number.isSafeInteger(event.details.contentIndex) ? event.details.contentIndex : 0 } : {};
      const next = last && last.afterTools === toolsSoFar && last.part === kind.part && last.contentIndex === kind.contentIndex
        ? [...segments.slice(0, -1), { ...last, text: `${last.text}${text}` }]
        : [...segments, { afterTools: toolsSoFar, ...kind, text }];
      patchSession(ctx, { streams: new Map(ctx.state.session.streams).set(operationId, next) }, { displayOnly: true });
    } else if (event.type === "session_event") {
      const details = isRecord(event.details) ? event.details : {};
      if (Array.isArray(details.kernelCells) && ctx.state.session.snapshot) patchSession(ctx, { snapshot: { ...ctx.state.session.snapshot, kernelCells: details.kernelCells } }, { displayOnly: true });
      if ((details?.sdkType === "tool_execution_end" && String(details.toolName).startsWith("terminal_"))
        || (details?.sdkType === "message_end" && details.message?.customType === "terminal-event")) {
        patchSession(ctx, { terminalRefreshKey: ctx.state.session.terminalRefreshKey + 1 });
      }
      if (details?.sdkType === "queue_update" && ctx.state.session.snapshot && Array.isArray(details.steering) && Array.isArray(details.followUp)) {
        patchSession(ctx, { snapshot: { ...ctx.state.session.snapshot, queuedMessages: { steering: details.steering, followUp: details.followUp } } });
      }
      if (details?.sdkType === "message_end" && ctx.state.session.snapshot && isRecord(details.message) && typeof details.message.role === "string") {
        const operationId = safeText(event.operationId) || "live";
        const streams = details.message.role === "assistant" && ctx.state.session.streams.has(operationId)
          ? new Map([...ctx.state.session.streams].filter(([key]) => key !== operationId))
          : ctx.state.session.streams;
        const snapshot = details.message.role === "assistant" && details.message.stopReason === "error"
          ? ctx.state.session.snapshot
          : { ...ctx.state.session.snapshot, messages: [...ctx.state.session.snapshot.messages, details.message] };
        patchSession(ctx, { snapshot, streams });
      }
      patchSession(ctx, { toolRuns: ingestToolEvent(ctx.state.session.toolRuns, details, ctx.state.selectedSessionId || "session", event.operationId, event.timestamp) }, { displayOnly: !["tool_execution_end", "agent_end", "agent_settled", "queue_update", "message_end"].includes(details?.sdkType) });
      const lifecycle = safeText(details.lifecycleType);
      const sessionId = safeText(event.sessionId);
      const sessionState = lifecycle.replace(/^session_/, "");
      if (sessionId && ["starting", "running", "idle", "sleeping", "waking", "closing", "closed"].includes(sessionState)) {
        updateSessionRow(ctx, sessionId, { state: sessionState });
      }
    } else if (event.type === "state_changed") {
      handleStateChanged(ctx, event);
    } else if (event.type === "request_accepted") {
      const operationId = safeText(event.operationId);
      if (operationId) {
        const stale = ctx.state.session.banner?.operationId && ctx.state.session.banner.operationId !== operationId;
        patchSession(ctx, { operations: mergeEntry(ctx, ctx.state.session.operations, operationId, { accepted: true }), ...(stale ? { banner: null } : {}) });
        reconcileRequest(ctx, event.requestId, operationId);
        persistCurrentSession(ctx);
      }
    } else if (event.type === "request_rejected") {
      const requestIdValue = safeText(event.requestId);
      if (requestIdValue && ctx.state.session.localMessages.has(requestIdValue)) {
        patchSession(ctx, { localMessages: mergeEntry(ctx, ctx.state.session.localMessages, requestIdValue, { status: "rejected" }) });
      }
      addActivity(ctx, { title: "请求被拒绝", time: event.timestamp, meta: printable(event.details), tone: "error" });
      persistCurrentSession(ctx);
    } else if (event.type === "operation_cancel_requested") {
      const operationId = safeText(event.operationId);
      patchSession(ctx, { operations: mergeEntry(ctx, ctx.state.session.operations, operationId, { cancelRequested: true }) });
      restoreReturnedMessages(ctx, operationId, event.details?.returnedMessages, event.sessionId);
      addActivity(ctx, { title: "已请求取消 · 尚未代表完成", time: event.timestamp, meta: operationId, tone: "notice" });
    } else if (event.type === "operation_completed") {
      handleOperationCompletion(ctx, event.details, event);
    } else if (event.type === "session_close_completed") {
      updateSessionRow(ctx, safeText(event.sessionId), { state: "closed" });
    } else if (event.type === "session_close_failed") {
      addActivity(ctx, { title: "关闭失败 · 资源状态未确认", time: event.timestamp, meta: printable(event.details), tone: "error" });
      setBanner(ctx, "关闭失败。", "error");
    } else if (event.type === "host_closed") {
      if (Number(event.details?.failureCount) > 0) addActivity(ctx, { title: "会话已结束 · 资源清理未确认", time: event.timestamp, meta: printable(event.details), tone: "error" });
      patchSession(ctx, { snapshot: ctx.state.session.snapshot ? { ...ctx.state.session.snapshot, state: "closed" } : ctx.state.session.snapshot });
      if (ctx.state.selectedSessionId) updateSessionRow(ctx, ctx.state.selectedSessionId, { state: "closed" });
        // Only the collection's final route-close event ends this observation.
      patchSession(ctx, { connection: "disconnected" });
    } else if (event.type === "message_end") {
      addActivity(ctx, { title: "消息终态已到达", time: event.timestamp, meta: safeText(event.operationId), tone: "" });
    }
    persistCurrentSession(ctx);
  }

