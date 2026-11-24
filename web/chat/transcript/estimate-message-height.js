const LINE_HEIGHT = 27;

export function estimateMessageHeight(message, width) {
  if (!message) return 56;
  const { role, content, metadata } = message;
  if (metadata?.isOptimistic) return 24;
  if (role === "system") return 36;
  const user = role === "user";
  const custom = metadata?.custom;
  const bodyWidth = user && !custom?.peerMessage ? Math.min(width * (width < 600 ? 0.88 : 0.72), 640) - 34 : width;
  const columns = Math.max(16, Math.floor(bodyWidth / 8));
  let lastProcess = -1;
  if (!user) lastProcess = content.findLastIndex((part) => part.type === "tool-call" || part.type === "reasoning");
  const text = content.slice(lastProcess + 1).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const lines = text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.replace(/[^\x00-\x7f]/g, "ww").length / columns)), 0);
  const textHeight = text ? lines * LINE_HEIGHT : 0;
  if (user) {
    const attachments = custom?.attachments?.some(({ type }) => type?.startsWith("image/")) ? 160 : custom?.attachments?.length ? 30 : 0;
    return 54 + Math.min(textHeight, 240) + attachments + (custom?.references?.length ? 26 : 0);
  }
  return Math.max(24, (lastProcess >= 0 ? 38 : 0) + textHeight + (text ? 36 : 0));
}
