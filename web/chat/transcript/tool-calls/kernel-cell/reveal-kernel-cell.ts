import type { KernelEvent, TranscriptMessage } from "../../../conversation/conversation-types.ts";
import { sameCell } from "./same-cell.ts";
import { messageForToolCall } from "./message-for-tool-call.ts";

type RevealMessage = (id: string, options: { prepare: (message: Element) => Element | null }) => void;

export function revealKernelCell(event: { preventDefault: () => void }, cell: KernelEvent, messages: readonly TranscriptMessage[], revealMessage: RevealMessage) {
  event.preventDefault();
  const id = messageForToolCall(messages, cell.toolCallId);
  if (!id) return;
  revealMessage(id, { prepare: (message) => {
    const row = message.querySelector(`#${CSS.escape(`kernel-cell-${cell.cellId}`)}`);
    if (!(row instanceof HTMLElement) || !sameCell(row.dataset, cell)) return null;
    for (let node: Element | null = row; node && node !== message; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    return row.querySelector(":scope > summary") || row;
  } });
}
