import type { HostBindingContext } from "../host-binding-state.ts";

export function dispose(ctx: HostBindingContext): void {
  (0, ctx.unsubscribe)?.();
  ctx.subscribers.clear();
}
