import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";

export function observeToolExecution(ctx: UiContext): () => void {
  return ctx.session.subscribe((event) => {
    if (event.type === "tool_execution_start") ctx.executions.set(event.toolCallId, { toolName: event.toolName, parentToolCallId: event.parentToolCallId, args: event.args, started: true, partial: true, isError: false });
    else if (event.type === "tool_execution_update") ctx.executions.set(event.toolCallId, { ...ctx.executions.get(event.toolCallId), toolName: event.toolName, parentToolCallId: event.parentToolCallId, args: event.args, result: event.partialResult, started: true, partial: true, isError: false });
    else if (event.type === "tool_execution_end") ctx.executions.set(event.toolCallId, { toolName: event.toolName, parentToolCallId: event.parentToolCallId, args: ctx.executions.get(event.toolCallId)?.args ?? {}, result: event.result, started: true, partial: false, isError: event.isError, durationMs: event.durationMs });
    else if (event.type === "agent_end") ctx.executions.clear();
    publish(ctx);
  });
}
