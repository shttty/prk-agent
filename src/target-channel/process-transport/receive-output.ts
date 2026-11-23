import type { ProcessTransportState } from "./transport-state.ts";
import { close } from "./close.ts";

/** Only the gap between process start and the first runtime listener is buffered here. */
export function receiveOutput(ctx: ProcessTransportState, bytes: Uint8Array): void {
  if (ctx.closed !== undefined) return;
  if (!ctx.dataListeners.size && ctx.pendingBytes + bytes.byteLength > ctx.limits.maxFrameBytes) {
    void close(ctx, "Target process stdout before listener exceeds frame limit.").catch(() => {});
    return;
  }
  const text = ctx.decoder.write(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  if (!ctx.dataListeners.size) {
    ctx.pendingBytes += bytes.byteLength;
    if (text) ctx.pending.push(text);
  } else if (text) {
    for (const listener of ctx.dataListeners) listener(text);
  }
}
