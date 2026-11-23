import { Buffer } from "node:buffer";
import type { ReplayContext } from "./replay-state.ts";

/** The ring as text, never starting inside a string control whose opening was evicted: such a cut-off payload (half a
 * Sixel/Kitty/iTerm2 image in Base64) would print as text. It is dropped up to the control's end; a control still open
 * is reopened as one xterm ignores (OSC for OSC, PM otherwise), so the payload still arriving stays invisible. */
export function readSnapshot(ctx: ReplayContext): string {
  const start = (ctx.end - ctx.length + ctx.bytes.length) % ctx.bytes.length;
  const first = Math.min(ctx.length, ctx.bytes.length - start);
  const result = Buffer.allocUnsafe(ctx.length);
  ctx.bytes.copy(result, 0, start, start + first);
  ctx.bytes.copy(result, first, 0, ctx.length - first);
  const origin = ctx.total - ctx.length;
  const [opened, ended, osc] = ctx.strings;
  if (opened === undefined || opened >= origin) return result.toString("utf8");
  if (ended === -1) return osc ? "\x1b]" : "\x1b^";
  // An ESC end stays (it is the ST, or starts the next sequence); BEL, CAN or SUB is consumed with the string.
  const cut = ended! - origin + (result[ended! - origin] === 0x1b ? 0 : 1);
  return result.subarray(cut).toString("utf8");
}
