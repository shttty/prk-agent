import type { TranscriptMessage } from "../conversation/conversation-types.ts";
import type { TranscriptDisplay } from "./presentation-types.ts";
export function transcriptVisibility(message: Pick<TranscriptMessage, "role" | "status">, { showThinking = true, streamOutput = true }: Partial<TranscriptDisplay> = {}) {
  return {
    showThinking,
    showText: message.role !== "assistant" || message.status?.type !== "running" || streamOutput,
  };
}
