import type { InputSource } from "@earendil-works/pi-coding-agent";
import type { MemoryReviewContext } from "./review-types.ts";

export function countInput(ctx: MemoryReviewContext, source: InputSource): void {
  if (!ctx.closed && source !== "extension") ctx.turns++;
}
