import type { HostBindingContext } from "../host-binding-state.ts";

export function close(ctx: HostBindingContext): Promise<void> {
  return ctx.parent.methods.endSession(ctx.sessionId);
}
