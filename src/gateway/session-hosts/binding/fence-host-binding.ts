import type { HostBindingContext } from "../host-binding-state.ts";

export function fence(ctx: HostBindingContext): void {
  ctx.fenced = ctx.source ?? ctx.original ?? ctx.parent.host.collection.get(ctx.sessionId)?.host;
  (0, ctx.unsubscribe)?.();
  ctx.unsubscribe = undefined;
  ctx.source = undefined;
  ctx.original = undefined;
  ctx.binding.idleSince = undefined;
}
