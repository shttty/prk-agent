import type { UiContext, ToolExecutionSnapshot } from "../ui-types.ts";

export function getToolExecution(ctx: UiContext, id: string): ToolExecutionSnapshot | undefined {
    const execution = ctx.executions.get(id);
    return execution ? { args: execution.args, ...(execution.result === undefined ? {} : { result: execution.result }) } : undefined;
  }
