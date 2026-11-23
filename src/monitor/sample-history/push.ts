import type { SampleHistoryContext } from "./sample-history-state.ts";
import { expire } from "./expire.ts";

export function push<T>(ctx: SampleHistoryContext<T>, at: number, value: T): void {
  expire(ctx, at);
  if (ctx.size === ctx.capacity) {
    ctx.start = (ctx.start + 1) % ctx.capacity;
    ctx.size--;
  }
  ctx.entries[(ctx.start + ctx.size) % ctx.capacity] = { at, value };
  ctx.size++;
}
