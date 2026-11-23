import type { KernelContext } from "../kernel-state.ts";

export function afterCompaction(ctx: KernelContext): void {
  ctx.namespaceAfterCompaction = true;
}
