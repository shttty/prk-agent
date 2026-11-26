import type { ImageItem } from "./image-item-types.ts";

/** Where an image came from, for the caption. */
export function imageOrigin(item: ImageItem): string {
  switch (item.kind) {
    case "markdown": case "artifact": return item.path;
    case "kernel": return `cell ${item.cell.cellId}`;
    case "tool": return `${item.toolName} · ${item.toolCallId}`;
    case "attachment": return `第 ${item.messageNumber} 条消息 · ${item.label}`;
  }
}
