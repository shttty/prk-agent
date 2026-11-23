import type { MachineSample } from "../telemetry/telemetry-types.ts";
import type { MetricSeries } from "../custom-metrics/custom-metrics-types.ts";

export interface TimedSample<T> { readonly at: number; readonly value: T }
export interface MonitorHistory {
  readonly instance: string;
  readonly windowMs: number;
  readonly machine: readonly TimedSample<MachineSample>[];
  readonly customMetrics: readonly MetricSeries[];
}
