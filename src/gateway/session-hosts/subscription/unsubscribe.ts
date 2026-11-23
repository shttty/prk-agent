import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function unsubscribe(ctx: HostBindingContext, listener: (event: SessionHostEvent) => void): void {
  ctx.subscribers.delete(listener);
}
