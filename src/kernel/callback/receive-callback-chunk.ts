import type { KernelCell, KernelContext, KernelProcess } from "../kernel-state.ts";
import { answer } from "./answer.ts";

export interface CallbackChunk {
  readonly requestId: number;
  readonly channel: string;
  capture?: { bytes: number; text: string; decoder: TextDecoder };
  error?: string;
  finalReplyId?: number;
}

interface ChunkMessage {
  requestId: number;
  channel: string;
  data: string;
  final: boolean;
}

export function receiveCallbackChunk(ctx: KernelContext, process: KernelProcess, cell: KernelCell, message: ChunkMessage): void {
  if (cell.callbacks.signal.aborted) return;
  const { requestId, channel, data, final } = message;
  if (!Number.isSafeInteger(requestId) || requestId < 1) throw new Error("Invalid kernel callback request identity.");

  let chunk = cell.callbackChunk;
  if (chunk?.requestId !== requestId) {
    if (requestId <= (cell.lastCallbackRequestId ?? 0)) return;
    // Remember dropped IDs too: a continuation cannot become a new request after the slot opens.
    cell.lastCallbackRequestId = requestId;
    if (chunk) {
      if (chunk.finalReplyId === undefined || process.pendingRequests.has(chunk.finalReplyId)) return;
      // receive() can route the next request in the same read as the final ACK, before answer's finally runs.
      cell.callbackPending = false;
    }
    chunk = cell.callbackChunk = {
      requestId, channel, capture: { bytes: 0, text: "", decoder: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }) },
    };
  }
  if (cell.callbackPending) return;

  const capture = chunk.capture;
  if (capture) {
    if (chunk.channel !== channel) reject(chunk, "Callback channel changed within a request.");
    else if (data.length % 4 !== 0 || /[^A-Za-z0-9+/=]|=[^=]|={3}/u.test(data)) reject(chunk, "Invalid base64 callback data.");
    else {
      capture.bytes += Buffer.byteLength(data, "base64");
      if (capture.bytes > ctx.configuration.processWindow.maxBytes) reject(chunk, "Callback request exceeds process message budget.");
      else {
        try { capture.text += capture.decoder.decode(Buffer.from(data, "base64"), { stream: !final }); }
        catch { reject(chunk, "Invalid UTF-8 callback data."); }
      }
    }
  }
  if (!final) return;

  let payload: unknown;
  if (chunk.capture) {
    try { payload = JSON.parse(chunk.capture.text); }
    catch { reject(chunk, "Invalid callback JSON."); }
    chunk.capture = undefined;
  }
  void answer(ctx, process, cell, chunk, payload);
}

function reject(chunk: CallbackChunk, error: string): void {
  // Drain this request through its final marker without retaining any more payload.
  chunk.capture = undefined;
  chunk.error = error;
}
