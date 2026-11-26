import { transcriptVisibility } from "./transcript-visibility.js";
import { turnGrouping } from "./turns/turn-grouping.js";

const LINE_HEIGHT = 27;

export function estimateMessageHeight(message, width, display, imageCounts) {
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
    return 54 + Math.min(textHeight, custom?.peerMessage ? 76 : 240) + attachments + (custom?.references?.length ? 26 : 0);
  }
  const foldHeight = groups.filter(({ groupKey }) => groupKey !== undefined).length * 38;
  // Thumbnail grid: 176px wide, 112px high, 8px row/column gap, 12px bottom margin.
  const perRow = Math.max(1, Math.floor((width + 8) / 184));
  const imageHeight = display?.showImages === false ? 0 : content.reduce((height, part) => {
    const count = part.type === "tool-call" && part.toolName === "kernel_code" && (imageCounts?.get(part.toolCallId) || part.metadata?.outputPreview?.imageCount);
    return count ? height + Math.ceil(count / perRow) * 120 + 4 : height;
  }, 0);
  return Math.max(24, foldHeight + imageHeight + textHeight + (text ? 36 : 0) + (visibility.showText ? 0 : 24));
}
