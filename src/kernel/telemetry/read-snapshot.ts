import type { KernelContext } from "../kernel-state.ts";

export function getSnapshot(ctx: KernelContext) {
  return ctx.snapshot;
}
