import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import { SampleHistory } from "../sample-history/assemble-sample-history.ts";
import type { MetricRecord } from "./custom-metrics-types.ts";
import type { CustomMetricsContext } from "./custom-metrics-state.ts";

export function sync(ctx: CustomMetricsContext, lease: TargetLease, metrics: readonly CustomMetric[], leaseMs: number): Promise<unknown> | undefined {
  if (metrics !== ctx.definitions) {
    const next = new Map<string, MetricRecord>();
    for (const definition of metrics) {
      const previous = ctx.records.get(definition.name);
      next.set(definition.name, previous && JSON.stringify(previous.definition) === JSON.stringify(definition) ? previous : {
        definition, history: new SampleHistory(ctx.options.historyWindowMs, Math.ceil(ctx.options.historyWindowMs / Math.max(500, definition.interval_s * 1000)) + 2),
      });
    }
    ctx.records = next;
    ctx.definitions = metrics;
  }
  const active = leaseMs > 0 ? metrics : [];
  const key = JSON.stringify(active);
  if (key === ctx.configured && leaseMs <= 0) return;
  if (key === "[]" && ctx.configured === "") { ctx.configured = key; return; }
  ctx.configured = key;
  return lease.request("customMetrics", "config", { metrics: active, leaseMs,
    timeoutMs: ctx.options.customTimeoutMs, maxOutputBytes: ctx.options.customMaxOutputBytes });
}
