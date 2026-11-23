import type { AgentSession, InputSource, ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { MemoryResult, MemoryStore } from "../memory/memory-types.ts";
import type { ReviewSettings } from "../memory/layers/layer-types.ts";

export type MemoryScope = { readonly sessionId: string; readonly instance: string; readonly project?: string; readonly source: "model" | "review" };

export interface MemoryReview {
  input(source: InputSource): void;
  saved(): void;
  close(): Promise<void>;
}

export interface MemoryToolContext {
  readonly store: MemoryStore;
  readonly scope: MemoryScope;
  readonly saved?: (result: MemoryResult) => void | Promise<void>;
}

export interface MemoryReviewContext {
  readonly session: AgentSession;
  readonly modelRuntime: ModelRuntime;
  readonly store: MemoryStore;
  readonly scope: Omit<MemoryScope, "source">;
  /** Thresholds fixed when the session starts, like its frozen memory snapshot. */
  readonly thresholds: Pick<ReviewSettings, "userTurns" | "toolCalls">;
  turns: number;
  toolCalls: number;
  closed: boolean;
  running?: { controller: AbortController; completion: Promise<void> };
}
