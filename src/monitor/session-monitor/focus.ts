import type { MonitorContext } from "./monitor-state.ts";
import { sync } from "./sampling/sync.ts";
import { machineOf } from "./connection/get-machine.ts";
import { ensure } from "./connection/ensure.ts";

export function focus(ctx: MonitorContext, sessionId: string, open: boolean): void {
  const rec = ctx.sessions.get(sessionId);
  if (!rec || rec.machine === undefined || !ctx.options.enabled) return;
  clearTimeout(ctx.leaseTimers.get(sessionId));
  if (open) {
    ctx.leases.set(sessionId, ctx.now() + ctx.options.focusLeaseMs);
    const timer = setTimeout(() => { ctx.leases.delete(sessionId); const m = ctx.machines.get(rec.machine ?? ""); if (m) sync(ctx, m); }, ctx.options.focusLeaseMs + 5);
    timer.unref?.();
    ctx.leaseTimers.set(sessionId, timer);
  } else ctx.leases.delete(sessionId);
  const machine = machineOf(ctx, rec.machine);
  ensure(ctx, machine, false);
  sync(ctx, machine);
}
