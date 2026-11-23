import type { MetricSeries } from "./custom-metrics-types.ts";
import type { CustomMetricsContext } from "./custom-metrics-state.ts";

export function history(ctx: CustomMetricsContext, now: number): readonly MetricSeries[] {
  return [...ctx.records.values()].map(({ definition, history }) => ({ name: definition.name, unit: definition.unit, chart: "line", samples: history.snapshot(now) }));
}
