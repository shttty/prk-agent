import type { SampleHistoryContext } from "./sample-history-state.ts";

export function expire<T>(ctx: SampleHistoryContext<T>, now: number): void {
  while (ctx.size && ctx.entries[ctx.start]!.at < now - ctx.windowMs) {
    ctx.entries[ctx.start] = undefined;
    ctx.start = (ctx.start + 1) % ctx.capacity;
    ctx.size--;
  }
}
