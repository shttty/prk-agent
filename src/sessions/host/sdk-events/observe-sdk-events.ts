import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { HostContext } from "../host-types.ts";
import { cloneEventValue } from "./format-event-value.ts";
import { sdkExecutionDetails } from "./format-tool-event.ts";
import { clearFailure } from "../attention/clear-failure.ts";
import { receivingUserText } from "../snapshots/read-receiving-user-text.ts";
import { emit } from "../subscriptions/publish-event.ts";

function unknownPythonOutcome(event: Extract<AgentSessionEvent, { type: "tool_execution_end" }>): boolean {
  if (event.toolName !== "kernel_code") return false;
  const result = event.result;
  const details = result && typeof result === "object" && "details" in result ? result.details : undefined;
  return !!details && typeof details === "object" && "outcome" in details && details.outcome === "unknown";
}

export function observeSdkEvents(ctx: HostContext, event: AgentSessionEvent): void {
  if (event.type === "compaction_start" && event.reason === "manual" && ctx.active?.kind === "compact" && ctx.active.cancelled) {
    // compact() first awaits its own SDK abort; its controller does not exist until this event.
    ctx.session.abortCompaction();
  }
  if (event.type === "message_end" && event.message.role === "assistant" && ctx.active) {
    if (event.message.stopReason === "aborted") ctx.active.aborted = true;
  }
  // Only the SDK knows whether a failed assistant attempt will be retried.
  // Do not clear operation errors on later successful messages: other invocations may have failed.
  if (event.type === "agent_start" || event.type === "auto_retry_start") clearFailure(ctx);
  if (event.type === "agent_end" && !event.willRetry && !("willContinue" in event && event.willContinue === true)) {
    for (let index = event.messages.length - 1; index >= 0; index--) {
      const message = event.messages[index];
      if (message.role !== "assistant") continue;
      if (message.stopReason === "error" && ctx.active) ctx.active.error = message.errorMessage ?? "SDK operation failed.";
      break;
    }
  }
  if (event.type === "agent_settled" && event.aborted && ctx.active) {
    ctx.active.aborted = true;
    ctx.active.cancelled = true;
    ctx.active.cancelReason ??= "SDK aborted the previous run.";
  }
  if (event.type === "tool_execution_start" && event.toolName === "kernel_code" && ctx.active) ctx.active.pythonStarted = true;
  if (event.type === "tool_execution_end" && unknownPythonOutcome(event) && ctx.active) ctx.active.unknown = true;
  if (event.type === "agent_start") emit(ctx, "operation_started", { operationId: ctx.active?.id });
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    emit(ctx, "message", { operationId: ctx.active?.id, text: event.assistantMessageEvent.delta });
  } else if (event.type === "message_update" && event.assistantMessageEvent.type === "thinking_delta") {
    const { delta, contentIndex } = event.assistantMessageEvent;
    emit(ctx, "message", { operationId: ctx.active?.id, text: delta, details: { part: "thinking", contentIndex } });
  } else if (event.type === "message_update") {
    emit(ctx, "session_event", { operationId: ctx.active?.id, details: { sdkType: event.type, assistantEvent: event.assistantMessageEvent.type } });
  } else if (event.type === "auto_retry_start") {
    emit(ctx, "session_event", { operationId: ctx.active?.id, details: { sdkType: event.type, attempt: event.attempt, maxAttempts: event.maxAttempts } });
  } else if (event.type === "tool_execution_start" || event.type === "tool_execution_update" || event.type === "tool_execution_end") {
    emit(ctx, "session_event", { operationId: ctx.active?.id, details: sdkExecutionDetails(event) });
  } else if (event.type === "queue_update") {
    // Pi removes the input before awaiting normalization and message_start hooks. Its public state already holds that input.
    emit(ctx, "session_event", { operationId: ctx.active?.id, details: { sdkType: event.type, steering: event.steering, followUp: event.followUp, receivingUserText: receivingUserText(ctx.session) } });
  } else if (event.type === "message_start" || event.type === "message_end") {
    emit(ctx, "session_event", { operationId: ctx.active?.id, details: { sdkType: event.type, message: cloneEventValue(event.message), ...(event.type === "message_start" && event.message.role === "user" ? { receivingUserText: receivingUserText(ctx.session) } : {}) } });
  } else emit(ctx, "session_event", { operationId: ctx.active?.id, details: { sdkType: event.type } });
}
