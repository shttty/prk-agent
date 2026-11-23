import type { MetricView } from "./custom-metrics-types.ts";
import type { CustomMetricsContext } from "./custom-metrics-state.ts";

export function view(ctx: CustomMetricsContext): readonly MetricView[] {
  return [...ctx.records.values()].map(({ definition, sample }) => ({ name: definition.name, unit: definition.unit, chart: "line", ...(sample ? { sample } : {}) }));
}
