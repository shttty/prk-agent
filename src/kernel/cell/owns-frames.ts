import type { KernelCell, KernelContext, KernelProcess } from "../kernel-state.ts";

export function ownsFrames(ctx: KernelContext, process: KernelProcess, cell: KernelCell): boolean {
  return ctx.process === process && !process.retired && cell.kernelId === process.generation
    && cell.requestId !== undefined && cell.outcome === undefined
    && (ctx.cells.get(cell.id) === cell || ctx.maintenance === cell);
}
