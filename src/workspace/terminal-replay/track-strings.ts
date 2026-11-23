import type { Buffer } from "node:buffer";
import type { ReplayContext } from "./replay-state.ts";

const ESC = 0x1b, BEL = 0x07, CAN = 0x18, SUB = 0x1a, OSC = 0x5d;
// ESC P (DCS: Sixel), ESC ] (OSC: iTerm2 images), ESC _ (APC: Kitty graphics), ESC ^ (PM), ESC X (SOS).
const INTRODUCERS = new Set([0x50, OSC, 0x5f, 0x5e, 0x58]);

/** Records where string controls start and end in `bytes` (appended at absolute offset `ctx.total`), as xterm's parser
 * ends them: any ESC, CAN or SUB, and BEL for OSC. Image payloads never contain ESC, so this is exact for them. */
export function trackStrings(ctx: ReplayContext, bytes: Buffer): void {
  const base = ctx.total;
  let index = 0;
  while (index < bytes.length) {
    if (ctx.mode === 0) {
      const at = bytes.indexOf(ESC, index);
      if (at < 0) break;
      ctx.mode = 1;
      ctx.escapeAt = base + at;
      index = at + 1;
    } else if (ctx.mode === 1) {
      const next = bytes[index]!;
      if (INTRODUCERS.has(next)) {
        ctx.strings.push(ctx.escapeAt, -1, next === OSC ? 1 : 0);
        ctx.mode = 2;
        index++;
      } else ctx.mode = 0; // anything else (including another ESC) is rescanned from ground
    } else {
      const osc = ctx.strings.at(-1) === 1;
      const ends = [ESC, CAN, SUB, ...(osc ? [BEL] : [])].map((byte) => bytes.indexOf(byte, index)).filter((at) => at >= 0);
      if (!ends.length) break;
      const at = Math.min(...ends);
      ctx.strings[ctx.strings.length - 2] = base + at;
      ctx.mode = 0;
      index = bytes[at] === ESC ? at : at + 1;
    }
  }
  ctx.total += bytes.length;
}
