import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { MonitorOptions } from "../../config/monitor/monitor-options.ts";
import type { MetricRecord } from "./custom-metrics-types.ts";

export interface CustomMetricsContext {
  readonly options: MonitorOptions;
  records: Map<string, MetricRecord>;
  definitions: readonly CustomMetric[] | undefined;
  configured: string;
}
