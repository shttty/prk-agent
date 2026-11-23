import type { KernelContext } from "../kernel-state.ts";
import type { KernelSnapshot } from "../kernel-types.ts";
import { previewCell } from "../cell/preview-cell.ts";

export function publish(ctx: KernelContext, patch: Partial<Omit<KernelSnapshot, "activeCells">>): void {
  const next = { ...ctx.snapshot, ...patch };
  const activeCells: KernelSnapshot["activeCells"][number][] = [];
  let now: number | undefined;
  for (const cell of ctx.cells.values()) {
    if (!cell.yielded || !cell.kernelId || !cell.toolCallId || cell.kernelId !== next.kernelId) continue;
    const preview = previewCell(ctx, cell.id, true, now ??= ctx.clock.now());
    if (preview) activeCells.push(preview);
  }
  const snapshot = ctx.snapshot = { ...next, activeCells };
  for (const listener of [...ctx.listeners]) {
    try { void Promise.resolve(listener(snapshot)).catch(() => {}); }
    catch { /* An observer cannot change execution. */ }
  }
}
