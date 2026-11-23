import type { KernelContext, KernelCell, KernelProcess } from "../kernel-state.ts";
import { send } from "../protocol/send.ts";
import { publish } from "../telemetry/publish.ts";
import { interrupt } from "../process/interrupt.ts";

export function run(ctx: KernelContext, process: KernelProcess, cell: KernelCell, command: Record<string, unknown>, signal?: AbortSignal) {
  if (ctx.closed) throw new Error("Kernel is closed.");
  if (ctx.process !== process || process.retired) throw new Error("Kernel generation is unavailable.");
  const abort = () => {
    if (cell.requestId !== undefined) void interrupt(ctx, cell, "Tool call cancelled.").catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  cell.detachSignal = () => signal?.removeEventListener("abort", abort);
  try {
    publish(ctx, { state: "busy", lastOutcome: undefined });
    if (ctx.closed || ctx.handoff || process.retired) throw new Error("Kernel closed or changed owner before submission.");
    signal?.throwIfAborted();
    cell.kernelId = process.generation;
    cell.submittedAt = ctx.clock.now();
    if (cell === ctx.maintenance) cell.activeSince = cell.submittedAt;
    if (process.language === "python" && command.kind === "execute"
      && (command.mode ?? command.defaultCellMode) === "isolated") cell.isolatedCandidate = true;
    send(process, { ...command, cellId: cell.id }, cell);
    if (cell.isolatedCandidate) process.isolatedSubmitted = true;
  } catch (error) {
    cell.detachSignal?.();
    cell.cancelBudget?.();
    cell.callbacks.abort();
    throw error;
  }
  return cell.done.then(async (outcome) => {
    if (cell.interruption) await cell.interruption.delivery.catch(() => {});
    return outcome;
  });
}
