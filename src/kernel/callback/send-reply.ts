import type { KernelContext, KernelProcess, KernelCell } from "../kernel-state.ts";
import { sendControl } from "../protocol/send-control.ts";
import { callbackReplyChunk } from "../protocol/callback-reply-chunk.ts";

interface ReplyOwner {
  ownsRequest(): boolean;
  finalWritten(id: number): void;
}

export async function sendReply(ctx: KernelContext, process: KernelProcess, cell: KernelCell, requestId: number,
  reply: { ok: boolean; value?: unknown; error?: string }, owner?: ReplyOwner): Promise<void> {
  let bytes: Buffer;
  try { bytes = Buffer.from(JSON.stringify(reply)); }
  catch { bytes = Buffer.from(JSON.stringify({ ok: false, error: "Callback result is not JSON serializable; side effects may already have occurred." })); }
  if (bytes.length > ctx.configuration.processWindow.maxBytes) {
    bytes = Buffer.from(JSON.stringify({ ok: false, error: "Callback result exceeds process message budget; side effects may already have occurred." }));
  }
  const size = process.callbackChunkBytes;
  const signal = cell.callbacks.signal;
  for (let offset = 0; offset < bytes.length; offset += size) {
    if (owner && !owner.ownsRequest()) return;
    const chunk = callbackReplyChunk(cell.id, requestId,
      bytes.subarray(offset, offset + size).toString("base64"), offset + size >= bytes.length);
    await sendControl(process, chunk, signal, (id) => {
      if (chunk.final) owner?.finalWritten(id);
      return process.window.waitForControl(chunk.kind, signal);
    });
  }
}
