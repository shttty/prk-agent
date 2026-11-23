import { Buffer } from "node:buffer";
import type { ReplayContext } from "./replay-state.ts";
import { trackStrings } from "./track-strings.ts";

export function appendOutput(ctx: ReplayContext, data: string): void {
  const incoming = Buffer.from(data, "utf8");
  trackStrings(ctx, incoming);
  const capacity = ctx.bytes.length;
  if (incoming.length >= capacity) {
    let start = incoming.length - capacity;
    while (start < incoming.length && (incoming[start]! & 0xc0) === 0x80) start++;
    ctx.length = incoming.copy(ctx.bytes, 0, start);
    ctx.end = ctx.length % capacity;
  } else {
    const first = Math.min(incoming.length, capacity - ctx.end);
    incoming.copy(ctx.bytes, ctx.end, 0, first);
    incoming.copy(ctx.bytes, 0, first);
    ctx.end = (ctx.end + incoming.length) % capacity;
    ctx.length = Math.min(capacity, ctx.length + incoming.length);
    let start = (ctx.end - ctx.length + capacity) % capacity;
    while (ctx.length && (ctx.bytes[start]! & 0xc0) === 0x80) {
      ctx.length--;
      start = (start + 1) % capacity;
    }
  }
  // Strings that ended before the ring's first byte can no longer cut it.
  const first = ctx.total - ctx.length;
  let drop = 0;
  while (drop < ctx.strings.length && ctx.strings[drop + 1] !== -1 && ctx.strings[drop + 1]! < first) drop += 3;
  if (drop) ctx.strings.splice(0, drop);
}
