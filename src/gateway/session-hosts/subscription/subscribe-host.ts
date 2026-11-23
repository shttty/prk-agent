import type { SessionHostEvent, SessionHostSubscription } from "../../../sessions/host/host-types.ts";
import type { HostBindingContext } from "../host-binding-state.ts";
import { snapshot } from "./read-host-snapshot.ts";
import { unsubscribe } from "./unsubscribe.ts";

export function subscribe(ctx: HostBindingContext, listener: (event: SessionHostEvent) => void): SessionHostSubscription {
  ctx.binding.refresh();
  const initial = snapshot(ctx);
  ctx.subscribers.add(listener);
  return { snapshot: initial, unsubscribe: () => { unsubscribe(ctx, listener); } };
}
