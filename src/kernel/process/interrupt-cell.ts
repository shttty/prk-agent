import type { KernelContext } from "../kernel-state.ts";
import type { KernelInterruptSource } from "../kernel-types.ts";
import { interrupt } from "./interrupt.ts";

export function interruptCell(ctx: KernelContext, kernelId: string, id: string, source: KernelInterruptSource): boolean {
  if (ctx.closed) return false;
  const cell = ctx.cells.get(id) ?? (source === "user" ? ctx.pendingFinished.get(id) : undefined);
  if (!cell?.yielded || cell.kernelId !== kernelId) return false;
  if (source === "user") cell.userStopped = true;
  else if (cell.outcome !== undefined) return false;
  const reason = source === "user" ? "Stopped by the user." : "Kernel notification delivery failed.";
  void interrupt(ctx, cell, reason).catch(() => {});
  return true;
}
