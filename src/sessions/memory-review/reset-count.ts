import type { MemoryReviewContext } from "./review-types.ts";

export function resetCount(ctx: MemoryReviewContext): void {
  ctx.turns = 0;
  ctx.toolCalls = 0;
}
