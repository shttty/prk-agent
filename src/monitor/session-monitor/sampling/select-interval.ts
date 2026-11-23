import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";

export function intervalFor(ctx: MonitorContext, machine: MachineRecord): number {
  const at = ctx.now();
  for (const [sessionId, rec] of ctx.sessions) {
    if (rec.machine === machine.id && (ctx.leases.get(sessionId) ?? 0) > at) return ctx.options.fastIntervalMs;
  }
  return ctx.options.slowIntervalMs;
}
