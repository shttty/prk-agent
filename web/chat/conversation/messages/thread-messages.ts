import type { ThreadMessage } from "@assistant-ui/react";
import type { TranscriptMessage } from "../conversation-types.ts";

/**
 * The projection is what assistant-ui renders as `ThreadMessage`; its JSON-value types for tool arguments and
 * results are narrower than the payloads the Gateway sends, so the hand-off is one cast here.
 */
export function threadMessages(messages: readonly TranscriptMessage[]): readonly ThreadMessage[] {
  return messages as unknown as readonly ThreadMessage[];
}
