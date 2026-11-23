import type { MonitorContext } from "./monitor-state.ts";
import { teardown } from "./connection/teardown.ts";

export async function close(ctx: MonitorContext): Promise<void> {
  ctx.closed = true;
  for (const timer of ctx.leaseTimers.values()) clearTimeout(timer);
  for (const rec of ctx.sessions.values()) clearTimeout(rec.refreshTimer);
  const links = [...ctx.machines.values()].map((machine) => {
    const link = teardown(ctx, machine);
    machine.state = "stopped";
    return link?.catch(() => undefined);
  });
  await Promise.all(links);
}
