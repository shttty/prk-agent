import type { LeaseContext } from "./lease-state.ts";

export function release(ctx: LeaseContext): Promise<void> {
  const { lease, target, stop } = ctx;
  if (ctx.released) return ctx.released;
  lease.abort.abort(new Error("Target channel lease released."));
  lease.events.clear();
  lease.states.clear();
  target.leases.delete(lease);
  ctx.released = target.leases.size ? Promise.resolve() : stop(target);
  return ctx.released;
}
