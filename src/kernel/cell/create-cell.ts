import { randomUUID } from "node:crypto";
import type { KernelContext, KernelCell } from "../kernel-state.ts";
import type { PythonOutcome } from "../kernel-types.ts";
import { discardPartialImage } from "../output/capture-image.ts";

export function createCell(ctx: KernelContext, { timeoutMs, reminderLadderMs }: Pick<KernelCell, "timeoutMs" | "reminderLadderMs">): KernelCell {
  const terminal = Promise.withResolvers<PythonOutcome>();
  const cell: KernelCell = {
    id: randomUUID(), done: terminal.promise, released: Promise.withResolvers<void>(), callbacks: new AbortController(),
    resolve(outcome) {
      if (cell.outcome !== undefined) return;
      cell.outcome = outcome;
      const process = ctx.process;
      if (process && cell.kernelId === process.generation) discardPartialImage(process, cell);
      cell.endedAt = ctx.clock.now();
      cell.finishedAt = Date.now();
      cell.cancelBudget?.();
      cell.interruption?.cancelDeadline();
      cell.detachSignal?.();
      if (cell.pendingCallback) cell.pendingCallback.status = "discarded";
      clearTimeout(cell.progressTimer);
      cell.callbacks.abort();
      terminal.resolve(outcome);
    },
    startedAt: Date.now(), submittedAt: 0,
    yielded: false, userStopped: false, lateCallbacks: [], callbacksTruncated: false,
    output: { text: "", tail: "", omittedChars: 0, truncated: false }, details: { traces: [], phases: [], callbacks: [] },
    images: [], imageBytes: 0, omittedImages: 0,
    timeoutMs, reminderLadderMs,
    activeMs: 0, reminderStep: 0, reminderDue: reminderLadderMs[0],
    callbackPending: false, progressAt: 0, progressCount: 0, progressText: "",
  };
  return cell;
}
