import type { HostContext } from "../host-types.ts";
import type { KernelInterruptRequest, KernelInterruptResult } from "./cancel-types.ts";
import { requestCancel } from "./request-cancel.ts";
import { discardQueued } from "./discard-queued-input.ts";
import { discardInbox } from "../inbox/discard-inbox.ts";
import { lifecycle } from "../lifecycle/track-lifecycle.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";

export async function interruptCell(ctx: HostContext, { kernelId, cellId, cellOnly }: KernelInterruptRequest): Promise<KernelInterruptResult> {
  const kernel = ctx.kernel;
  const operation = ctx.active;
  if (ctx.closing || ctx.closed || !kernel?.interruptCell) {
    return { kernelId, cellId, status: "not_found", returnedMessages: [] };
  }
  const before = !cellOnly && !operation ? kernel.getSnapshot() : undefined;
  if (!kernel.interruptCell(kernelId, cellId, "user")) {
    return { kernelId, cellId, status: "not_found", returnedMessages: [] };
  }
  // Cell cancellation can publish synchronously. Only stop the captured operation,
  // and don't use a pending receipt from an old generation to select today's round.
  if (!cellOnly && operation && ctx.active === operation && !ctx.closing && !ctx.closed) {
    const currentKernelId = kernel.getSnapshot().kernelId;
    if (!currentKernelId || currentKernelId === kernelId) {
      operation.userCancelled = true;
      requestCancel(ctx, operation);
      return { kernelId, cellId, status: "requested", returnedMessages: [...operation.returnedMessages] };
    }
  }
  const result: KernelInterruptResult = { kernelId, cellId, status: "requested", returnedMessages: [] };
  if (!before || (before.kernelId && before.kernelId !== kernelId)) return result;
  // A pending receipt can still be stopped, but cannot select a round alongside other live cells.
  if (before.activeCells.length && !before.activeCells.some((cell) => cell.kernelId === kernelId && cell.cellId === cellId)) return result;
  // SDK/UI publications can reenter. Existing peers are allowed; a replacement is not.
  const stillCurrent = () => {
    if (ctx.active || ctx.kernel !== kernel || ctx.closing || ctx.closed) return false;
    const snapshot = kernel.getSnapshot();
    return (!snapshot.kernelId || snapshot.kernelId === kernelId) && snapshot.activeCells.every((cell) =>
      before.activeCells.some((seen) => seen.kernelId === cell.kernelId && seen.cellId === cell.cellId));
  };
  if (!stillCurrent()) return result;
  const reason = "User cancelled the previous run.";
  ctx.options.extensionUi?.cancel("operation");
  if (!stillCurrent()) return result;
  discardInbox(ctx, reason);
  const returnedMessages = discardQueued(ctx, undefined, reason);
  if (stillCurrent()) {
    ctx.options.extensionHandlers?.cancel();
    if (stillCurrent()) void lifecycle(ctx, () => ctx.session.abort()).catch((error: unknown) => {
      console.error(`Kernel interrupt SDK abort failed: ${describeError(error, ctx.sessionOptions)}`);
    });
  }
  return { ...result, returnedMessages };
}
