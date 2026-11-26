import type { TranscriptMessage } from "../../../conversation/conversation-types.ts";
export function messageForToolCall(messages: readonly TranscriptMessage[], toolCallId: string | undefined) {
  if (!toolCallId) return undefined;
  return messages.find(({ content }) => content.some((part) => part.type === "tool-call" && part.toolCallId === toolCallId))?.id;
}
