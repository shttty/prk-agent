import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { SampleHistory } from "../sample-history/assemble-sample-history.ts";
import type { TimedSample } from "../sample-history/sample-history-types.ts";

export interface MetricResult { readonly value: number | null; readonly error: string | null }
export interface MetricView {
  readonly name: string;
  readonly unit?: string;
  readonly chart: "line";
  readonly sample?: TimedSample<MetricResult>;
}
export interface MetricSeries extends Omit<MetricView, "sample"> { readonly samples: readonly TimedSample<MetricResult>[] }
export interface MetricRecord {
  readonly definition: CustomMetric;
  readonly history: SampleHistory<MetricResult>;
  sample?: TimedSample<MetricResult>;
}
