import type { KernelCell, KernelContext } from "../kernel-state.ts";
import { ownsFrames } from "../cell/owns-frames.ts";

export function publishProgress(ctx: KernelContext, cell: KernelCell): void {
  if (ctx.closed || !ctx.process || !ownsFrames(ctx, ctx.process, cell) || cell.callbacks.signal.aborted
    || cell.progressCount >= ctx.options.maxProgressUpdates) return;
  const now = performance.now();
  const delay = ctx.options.progressIntervalMs - (now - cell.progressAt);
  if (cell.progressCount && delay > 0) {
    cell.progressTimer ??= setTimeout(() => {
      cell.progressTimer = undefined;
      publishProgress(ctx, cell);
    }, delay).unref();
    return;
  }
  clearTimeout(cell.progressTimer);
  cell.progressTimer = undefined;
  cell.progressAt = now;
  cell.progressCount++;
  cell.onUpdate?.({ content: [{ type: "text", text: cell.progressText }],
    details: { target: ctx.configuration.target, outcome: "ok", truncated: false } });
}
