import type { ClientContext } from "../client-state.ts";
import type { HostEventListener } from "../client-types.ts";

export function subscribeHostEvents(ctx: ClientContext, listener: HostEventListener) {
  ctx.listeners.add(listener); return () => { ctx.listeners.delete(listener); };
}
