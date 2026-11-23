import type { KernelContext } from "../kernel-state.ts";
import type { KernelSnapshot } from "../kernel-types.ts";

export function subscribe(ctx: KernelContext, listener: (snapshot: KernelSnapshot) => void) {
  ctx.listeners.add(listener);
  return () => { ctx.listeners.delete(listener); };
}
