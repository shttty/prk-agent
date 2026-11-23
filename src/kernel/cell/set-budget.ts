import type { KernelContext, KernelCell } from "../kernel-state.ts";
import { interrupt } from "../process/interrupt.ts";
import { addOutput } from "../output/capture-output.ts";
import { publish } from "../telemetry/publish.ts";

export function setBudget(ctx: KernelContext, cell: KernelCell, paused: boolean, now = ctx.clock.now()): void {
  if (cell.mode === undefined && cell !== ctx.maintenance) return;
  cell.cancelBudget?.();
  cell.cancelBudget = undefined;
  if (paused) {
    if (cell.activeSince !== undefined) cell.activeMs += now - cell.activeSince;
    cell.activeSince = undefined;
  } else {
    cell.activeSince ??= now;
    schedule(ctx, cell);
  }
  if (cell.yielded) publish(ctx, {});
}

function schedule(ctx: KernelContext, cell: KernelCell): void {
  const { kernelId } = cell;
  if (!kernelId || cell.activeSince === undefined || cell.callbacks.signal.aborted) return;
  const deadline = cell.timeoutMs || Infinity;
  const due = Math.min(deadline, cell.reminderDue ?? Infinity);
  if (!Number.isFinite(due)) return;
  const activeAt = cell.activeSince - cell.activeMs;
  let cancel: () => void;
  const tick = () => {
    if (cell.cancelBudget !== cancel || cell.callbacks.signal.aborted) return;
    const now = ctx.clock.now();
    const activeMs = now - activeAt;
    while (cell.reminderDue !== undefined && cell.reminderDue <= activeMs && cell.reminderDue < deadline) {
      const dueMs = cell.reminderDue;
      // A due yield can share a timer tick with this reminder; return running first.
      if (cell.foregroundDue !== undefined && cell.foregroundDue <= activeAt + dueMs) {
        cell.cancelBudget = cancel = ctx.clock.schedule(tick, 1);
        return;
      }
      const step = ++cell.reminderStep;
      cell.reminderDue = cell.reminderLadderMs[step] ?? dueMs + cell.reminderLadderMs.at(-1)!;
      const reminder = { cellId: cell.id, kernelId, step, dueMs, activeMs, nextInMs: cell.reminderDue - dueMs };
      for (const listener of [...ctx.reminderListeners]) {
        try { listener(reminder); } catch { /* An observer cannot change execution. */ }
      }
      if (cell.cancelBudget !== cancel || cell.callbacks.signal.aborted) return;
    }
    if (activeMs >= deadline) {
      const error = new Error(`Kernel timed out after ${cell.timeoutMs}ms.`);
      addOutput(cell.output, `${error.message}\n`, ctx.options);
      void interrupt(ctx, cell, error.message).catch(() => {});
    } else schedule(ctx, cell);
  };
  cell.cancelBudget = cancel = ctx.clock.schedule(tick, Math.max(0, Math.ceil(activeAt + due - ctx.clock.now())));
}
