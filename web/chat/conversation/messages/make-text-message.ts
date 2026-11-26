import type { MessageCustom, MessageRole, TranscriptMessage } from "../conversation-types.ts";

export function makeTextMessage(text: string, id: string, createdAt: Date, role: MessageRole, custom: MessageCustom = {}): TranscriptMessage {
  return {
    id,
    role,
    content: [{ type: "text", text }],
    createdAt,
    metadata: { custom },
  };
}
