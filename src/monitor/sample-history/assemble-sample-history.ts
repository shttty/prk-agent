import type { SampleHistoryContext } from "./sample-history-state.ts";
import type { TimedSample } from "./sample-history-types.ts";
import { push } from "./push.ts";
import { snapshot } from "./snapshot.ts";

/** Lazily allocated ring; reads also expire samples when collection has stopped. */
export class SampleHistory<T> {
  push: (at: number, value: T) => void;
  snapshot: (now: number) => readonly TimedSample<T>[];

  constructor(windowMs: number, capacity: number) {
    const ctx: SampleHistoryContext<T> = { entries: [], start: 0, size: 0, windowMs, capacity };
    this.push = (at, value) => push(ctx, at, value);
    this.snapshot = (now) => snapshot(ctx, now);
  }
}
