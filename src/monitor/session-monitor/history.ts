import type { MonitorContext } from "./monitor-state.ts";
import type { MonitorHistory } from "../sample-history/sample-history-types.ts";

export function history(ctx: MonitorContext, instance: string): MonitorHistory { return { instance, windowMs: ctx.options.historyWindowMs, machine: ctx.machines.get(instance)?.history.snapshot(ctx.now()) ?? [], customMetrics: ctx.machines.get(instance)?.custom.history(ctx.now()) ?? [] }; }
