import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import { SampleHistory } from "../../sample-history/assemble-sample-history.ts";
import { CustomMetricStore } from "../../custom-metrics/assemble-custom-metrics.ts";

export function machineOf(ctx: MonitorContext, id: string): MachineRecord {
  let found = ctx.machines.get(id);
  if (!found) {
    found = { id, state: "stopped", error: undefined, lease: undefined, unsubscribe: undefined, intervalMs: undefined, watched: "",
      history: new SampleHistory(ctx.options.historyWindowMs, Math.ceil(ctx.options.historyWindowMs / Math.max(500, Math.min(ctx.options.fastIntervalMs, ctx.options.slowIntervalMs))) + 2),
      custom: new CustomMetricStore(ctx.options) };
    ctx.machines.set(id, found);
  }
  return found;
}
