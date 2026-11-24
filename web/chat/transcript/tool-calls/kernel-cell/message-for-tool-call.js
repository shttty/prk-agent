export function messageForToolCall(messages, toolCallId) {
  if (!toolCallId) return undefined;
  return messages.find(({ content }) => content.some((part) => part.type === "tool-call" && part.toolCallId === toolCallId))?.id;
}
