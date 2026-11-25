import { transcriptVisibility } from "./transcript-visibility.js";
import { turnGrouping } from "./turns/turn-grouping.js";

const LINE_HEIGHT = 27;

export function estimateMessageHeight(message, width, display) {
  if (!message) return 56;
  const { role, content, metadata } = message;
  if (metadata?.isOptimistic) return 24;
  if (role === "system") return 36;
  const user = role === "user";
  const custom = metadata?.custom;
  const bodyWidth = user && !custom?.peerMessage ? Math.min(width * (width < 600 ? 0.88 : 0.72), 640) - 34 : width;
  const columns = Math.max(16, Math.floor(bodyWidth / 8));
  const visibility = transcriptVisibility(message, display);
  const groups = user ? null : turnGrouping(content, message.status?.type !== "running", display?.turnFoldMode, visibility);
  const visible = groups ? groups.flatMap((group) => group.groupKey === undefined ? group.indices.map((index) => content[index]) : []) : content;
  const text = visibility.showText ? visible.filter((part) => part.type === "text").map((part) => part.text).join("\n") : "";
  const lines = text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.replace(/[^\x00-\x7f]/g, "ww").length / columns)), 0);
  const textHeight = text ? lines * LINE_HEIGHT : 0;
  if (user) {
    const attachments = custom?.attachments?.some(({ type }) => type?.startsWith("image/")) ? 160 : custom?.attachments?.length ? 30 : 0;
    return 54 + Math.min(textHeight, 240) + attachments + (custom?.references?.length ? 26 : 0);
  }
  const foldHeight = groups.filter(({ groupKey }) => groupKey !== undefined).length * 38;
  return Math.max(24, foldHeight + textHeight + (text ? 36 : 0) + (visibility.showText ? 0 : 24));
}
