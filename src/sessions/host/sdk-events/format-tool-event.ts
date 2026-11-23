import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { cloneEventValue } from "./format-event-value.ts";

export function sdkExecutionDetails(event: Extract<AgentSessionEvent, { type: "tool_execution_start" | "tool_execution_update" | "tool_execution_end" }>): Readonly<Record<string, unknown>> {
  // Set by the SDK only for calls another tool made through ctx.executeTool() (toolCallId is then `<parent>/<n>`).
  const parent = event.parentToolCallId ? { parentToolCallId: event.parentToolCallId } : {};
  if (event.type === "tool_execution_start") return {
    sdkType: event.type, toolCallId: event.toolCallId, toolName: event.toolName, args: cloneEventValue(event.args), ...parent,
  };
  if (event.type === "tool_execution_update") return {
    sdkType: event.type, toolCallId: event.toolCallId, toolName: event.toolName,
    args: cloneEventValue(event.args), partialResult: cloneEventValue(event.partialResult), ...parent,
  };
  return {
    sdkType: event.type, toolCallId: event.toolCallId, toolName: event.toolName,
    result: cloneEventValue(event.result), isError: event.isError, ...parent,
  };
}
