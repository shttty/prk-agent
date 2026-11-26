import type { MessageCustom, MessagePart, MessageStatus, TranscriptMessage } from "../conversation-types.ts";

export function makeAssistantMessage(parts: MessagePart[], id: string, createdAt: Date, status: MessageStatus = { type: "complete", reason: "stop" }, custom: MessageCustom = {}): TranscriptMessage {
  return {
    id,
    role: "assistant",
    content: parts.length ? parts : [{ type: "text", text: "" }],
    createdAt,
    status,
    metadata: {
      unstable_state: undefined,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom,
    },
  };
}
