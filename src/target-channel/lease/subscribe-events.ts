import type { TargetEvent } from "../channels/channel-types.ts";
import type { LeaseContext } from "./lease-state.ts";

export function subscribe(ctx: LeaseContext, listener: (event: TargetEvent) => void): () => void {
  const { lease } = ctx;
  if (!lease.abort.signal.aborted) lease.events.add(listener);
  return () => { lease.events.delete(listener); };
}
