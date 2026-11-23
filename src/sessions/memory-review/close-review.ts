import type { MemoryReviewContext } from "./review-types.ts";

export async function closeReview(ctx: MemoryReviewContext, unsubscribe: () => void): Promise<void> {
  ctx.closed = true;
  unsubscribe();
  ctx.running?.controller.abort();
  await ctx.running?.completion;
}
