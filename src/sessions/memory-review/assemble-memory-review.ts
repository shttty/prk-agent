import type { AgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { MemoryStore } from "../memory/memory-types.ts";
import type { ReviewSettings } from "../memory/layers/layer-types.ts";
import type { MemoryReview, MemoryScope, MemoryReviewContext } from "./review-types.ts";
import { observeSettled } from "./observe-settled.ts";
import { countInput } from "./count-input.ts";
import { resetCount } from "./reset-count.ts";
import { closeReview } from "./close-review.ts";

/** Only counters and the in-flight review are owned here; Pi owns the context snapshot and review loop. */
export function createMemoryReview(session: AgentSession, modelRuntime: ModelRuntime, store: MemoryStore, scope: Omit<MemoryScope, "source">, thresholds: Pick<ReviewSettings, "userTurns" | "toolCalls">): MemoryReview {
  const ctx: MemoryReviewContext = { session, modelRuntime, store, scope, thresholds, turns: 0, toolCalls: 0, closed: false };
  const unsubscribe = session.subscribe((event) => observeSettled(ctx, event));
  return {
    input(source): void { countInput(ctx, source); },
    saved(): void { resetCount(ctx); },
    async close(): Promise<void> { await closeReview(ctx, unsubscribe); },
  };
}
