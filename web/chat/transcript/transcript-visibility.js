export function transcriptVisibility(message, { showThinking = true, streamOutput = true } = {}) {
  return {
    showThinking,
    showText: message.role !== "assistant" || message.status?.type !== "running" || streamOutput,
  };
}
