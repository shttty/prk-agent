import type { HostBindingContext } from "../host-binding-state.ts";

export function isIdle(ctx: HostBindingContext): boolean {
  return !ctx.parent.lifecycle.transitions.has(ctx.sessionId) && ctx.original?.isIdle === true;
}
