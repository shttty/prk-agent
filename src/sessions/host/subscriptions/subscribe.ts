import type { HostContext, SessionHostEvent, SessionHostSubscription } from "../host-types.ts";
import { unsubscribe } from "./unsubscribe.ts";
import { snapshot } from "../snapshots/get-snapshot.ts";

export function subscribe(ctx: HostContext, listener: (event: SessionHostEvent) => void): SessionHostSubscription {
  ctx.listeners.add(listener);
  return { snapshot: snapshot(ctx), unsubscribe: () => { unsubscribe(ctx, listener); } };
}
