import type { HostContext, SessionHostEvent } from "../host-types.ts";

export function unsubscribe(ctx: HostContext, listener: (event: SessionHostEvent) => void): void {
  ctx.listeners.delete(listener);
}
