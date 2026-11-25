import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import { intervalFor } from "./select-interval.ts";
import { request } from "../connection/request.ts";
import { publishMachine } from "../subscriptions/publish-machine.ts";
import { watchedDirs } from "./list-watched-directories.ts";

export function sync(ctx: MonitorContext, machine: MachineRecord): void {
  if (machine.state !== "ok" || !machine.lease) return;
  let leaseMs = 0;
  for (const [sessionId, rec] of ctx.sessions) if (rec.machine === machine.id) leaseMs = Math.max(leaseMs, (ctx.leases.get(sessionId) ?? 0) - ctx.now());
  void machine.custom.sync(machine.lease, ctx.deps.customMetrics?.(machine.id) ?? [], leaseMs)?.catch((error: unknown) => ctx.log(`custom metrics ${machine.id}: ${String(error)}`));
  const interval = intervalFor(ctx, machine);
  if (interval !== machine.intervalMs) {
    machine.intervalMs = interval;
    request(ctx, machine, "config", { intervalMs: interval });
    publishMachine(ctx, machine);
  }
  const dirs = watchedDirs(ctx, machine);
  const processes = Object.fromEntries([...ctx.sessions].flatMap(([id, rec]) => {
    if (rec.machine !== machine.id) return [];
    const pids = ctx.deps.processRoots(id).map(({ pid }) => pid).slice(0, 128);
    return pids.length ? [[id, pids]] : [];
  }));
  const key = JSON.stringify({ dirs, processes });
  if (key !== machine.watched) {
    machine.watched = key;
    request(ctx, machine, "watch", { dirs, processes });
  }
}
