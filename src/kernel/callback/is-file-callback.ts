import type { KernelContext } from "../kernel-state.ts";

export function isFileCallback(ctx: KernelContext, name: string): boolean {
  return ctx.fileCallback.getStore() === name;
}
