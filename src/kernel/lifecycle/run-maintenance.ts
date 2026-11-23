import type { KernelContext, KernelProcess } from "../kernel-state.ts";
import { createCell } from "../cell/create-cell.ts";
import { run } from "../cell/run.ts";
import { setBudget } from "../cell/set-budget.ts";
import { releaseCellImages } from "../output/capture-image.ts";
import { publish } from "../telemetry/publish.ts";

export async function runMaintenance(ctx: KernelContext, process: KernelProcess, command: Record<string, unknown>) {
  const cell = ctx.maintenance = createCell(ctx, { timeoutMs: ctx.options.startTimeoutMs, reminderLadderMs: [] });
  try {
    const done = run(ctx, process, cell, command);
    if (cell.outcome === undefined) setBudget(ctx, cell, false);
    const outcome = await done;
    if (cell.rejection) throw cell.rejection;
    return { outcome, output: cell.output.text + cell.output.tail };
  } finally {
    releaseCellImages(process, cell);
    ctx.maintenance = undefined;
    cell.released.resolve();
    if (command.kind !== "initialize" && !ctx.closed && !process.retired) publish(ctx, { state: "idle", lastOutcome: cell.rejection ? undefined : cell.outcome });
  }
}
