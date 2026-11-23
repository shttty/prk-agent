import type { TimedSample } from "./sample-history-types.ts";

export interface SampleHistoryContext<T> {
  readonly entries: (TimedSample<T> | undefined)[];
  start: number;
  size: number;
  readonly windowMs: number;
  readonly capacity: number;
}
