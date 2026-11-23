import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";

export function teardown(ctx: MonitorContext, machine: MachineRecord): Promise<void> | undefined {
  machine.unsubscribe?.();
  machine.unsubscribe = undefined;
  const lease = machine.lease;
  const stopping = machine.state === "ok" && lease ? machine.custom.sync(lease, ctx.deps.customMetrics?.(machine.id) ?? [], 0) : undefined;
  machine.lease = undefined;
  machine.intervalMs = undefined;
  machine.watched = "";
  machine.custom.reset();
  return lease ? Promise.resolve(stopping).catch(() => ctx.log(`custom metrics ${machine.id}: stop failed`)).then(() => lease.release()) : undefined;
}
