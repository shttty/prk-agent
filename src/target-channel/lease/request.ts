import type { LeaseContext } from "./lease-state.ts";

export async function request(ctx: LeaseContext, mod: string, op: string, args?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { target, lease, waitForLink } = ctx;
  const link = await waitForLink(target, lease.abort.signal);
  return link.request(mod, op, args, lease.abort.signal);
}
