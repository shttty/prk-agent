import { sameCell } from "./same-cell.js";
import { messageForToolCall } from "./message-for-tool-call.js";

export function revealKernelCell(event, cell, messages, revealMessage) {
  event.preventDefault();
  const id = messageForToolCall(messages, cell.toolCallId);
  if (!id) return;
  revealMessage(id, { prepare: (message) => {
    const row = message.querySelector(`#${CSS.escape(`kernel-cell-${cell.cellId}`)}`);
    if (!sameCell(row?.dataset, cell)) return null;
    for (let node = row; node && node !== message; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
    }
    return row.querySelector(":scope > summary") || row;
  } });
}
