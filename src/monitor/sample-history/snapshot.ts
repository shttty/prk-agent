import type { SampleHistoryContext } from "./sample-history-state.ts";
import type { TimedSample } from "./sample-history-types.ts";
import { expire } from "./expire.ts";

export function snapshot<T>(ctx: SampleHistoryContext<T>, now: number): readonly TimedSample<T>[] {
  expire(ctx, now);
  return Array.from({ length: ctx.size }, (_, i) => ctx.entries[(ctx.start + i) % ctx.capacity]!);
}
