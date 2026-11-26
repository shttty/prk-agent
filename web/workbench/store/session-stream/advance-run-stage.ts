import type { SessionHostEvent } from "../../../../src/gateway/wire/web-types.ts";
import type { RunStage } from "../store-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";

const stage = (previous: RunStage | null, name: "thinking" | "output"): RunStage => (previous?.stage === name ? previous : { stage: name });

/**
 * Display-only stage of the selected session's running operation, advanced by its ordered host events:
 * waiting (operation start, after the last running tool ends) → thinking / output (stream deltas) → tool → … ;
 * retry while the SDK backs off. Returns `previous` itself when nothing changes.
 */
export function advanceRunStage(previous: RunStage | null, event: SessionHostEvent): RunStage | null {
  if (event.type === "operation_started") return { stage: "waiting" };
  if (event.type === "operation_completed") return null;
  if (event.type === "message") return stage(previous, event.details?.part === "thinking" ? "thinking" : "output");
  const details = event.type === "session_event" && isRecord(event.details) ? event.details : null;
  // Calls a tool made through ctx.executeTool() run inside the outer tool's stage.
  if (!details || details.parentToolCallId) return previous;
  if (details.sdkType === "message_update") return safeText(details.assistantEvent).startsWith("toolcall_") ? stage(previous, "output") : previous;
  if (details.sdkType === "auto_retry_start") return { stage: "retry", attempt: typeof details.attempt === "number" && Number.isSafeInteger(details.attempt) ? details.attempt : 1 };
  const running = previous?.stage === "tool" ? previous.tools : [];
  if (details.sdkType === "tool_execution_start") {
    return { stage: "tool", tools: [...running, { id: safeText(details.toolCallId), name: safeText(details.toolName) }] };
  }
  if (details.sdkType === "tool_execution_end") {
    const tools = running.filter((tool) => tool.id !== safeText(details.toolCallId));
    return tools.length ? { stage: "tool", tools } : { stage: "waiting" };
  }
  return previous;
}
