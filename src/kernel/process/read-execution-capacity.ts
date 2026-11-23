import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../kernel-options.ts";
import type { KernelContext } from "../kernel-state.ts";

export function readExecutionCapacity(ctx: KernelContext, configured?: number): number {
  if (ctx.process && !ctx.process.retired) return ctx.process.maxActiveCells;
  return ctx.startupMaxActiveCells ?? Math.min(ctx.runnerMaxActiveCells,
    configured ?? (ctx.hooks.executionPolicy?.() ?? DEFAULT_KERNEL_EXECUTION_POLICY).maxActiveCells);
}
