import type { ChannelContext } from "../channel-state.ts";
import { WireError } from "../../wire/create-error.ts";

export function receiveChunk(ctx: ChannelContext, chunk: Buffer): void {
  const { receive, invalid } = ctx;
  if (ctx.failed) return;
  let start = 0;
  while (start < chunk.length) {
    const end = chunk.indexOf(10, start);
    const stop = end < 0 ? chunk.length : end;
    const part = chunk.subarray(start, stop);
    if (ctx.buffered.length + part.length > ctx.maxBytes) {
      ctx.failed = true; invalid(new WireError("TOO_LARGE", "Frame exceeds byte limit.")); return;
    }
    ctx.buffered = Buffer.concat([ctx.buffered, part]);
    if (end < 0) return;
    let value: unknown;
    try { value = JSON.parse(ctx.decoder.decode(ctx.buffered)); }
    catch { ctx.failed = true; invalid(new WireError("INVALID_REQUEST", "Frame must be valid UTF-8 JSON.")); return; }
    ctx.buffered = Buffer.alloc(0);
    receive(value);
    if (ctx.socket.destroyed) return;
    start = end + 1;
  }
}
