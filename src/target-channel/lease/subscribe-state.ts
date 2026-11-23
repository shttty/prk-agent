import type { TargetState } from "../channels/channel-types.ts";
import type { LeaseContext } from "./lease-state.ts";

export function onState(ctx: LeaseContext, listener: (state: TargetState) => void): () => void {
  const { lease, target, notify, snapshot } = ctx;
  if (!lease.abort.signal.aborted) lease.states.add(listener);
  notify(listener, lease.abort.signal.aborted ? { state: "stopped" } : snapshot(target));
  return () => { lease.states.delete(listener); };
}
