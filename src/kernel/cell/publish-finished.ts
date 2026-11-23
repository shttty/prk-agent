import type { KernelCell, KernelContext } from "../kernel-state.ts";
import type { KernelCellResult, KernelFinishedCell } from "../kernel-types.ts";
import { measureCell } from "./measure-cell.ts";

export function publishFinished(ctx: KernelContext, cell: KernelCell, result: KernelCellResult): void {
  if (!ctx.finishedListeners.size || !cell.kernelId) return;
  ctx.pendingFinished.set(cell.id, cell);
  const finished: KernelFinishedCell = {
    cellId: cell.id, kernelId: cell.kernelId, startedAt: cell.startedAt, toolCallId: cell.toolCallId!,
    result, finishedAt: cell.finishedAt!, ...measureCell(cell, cell.endedAt!),
    imageCount: result.content.filter((part) => part.type === "image").length,
    reason: cell.reason, lateCallbacks: cell.lateCallbacks.map(({ name, status }) => ({ name, status })), callbacksTruncated: cell.callbacksTruncated,
    ...cell.retirement,
    userStopped: () => cell.userStopped,
    release: () => { ctx.pendingFinished.delete(cell.id); },
  };
  for (const listener of ctx.finishedListeners) {
    try { listener(finished); }
    catch (error) { finished.release(); console.error("[kernel] Finished observer failed:", error); }
  }
}
