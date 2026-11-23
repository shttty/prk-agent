export interface CustomMetric {
  readonly name: string;
  readonly command: string;
  readonly interval_s: number;
  readonly parse: string;
  readonly unit?: string;
  readonly chart?: "line";
}

export const METRIC_FIELDS: Record<string, true> = { name: true, command: true, interval_s: true, parse: true, unit: true, chart: true };
export const MAX_TIMER_MS = 2_147_483_647;
