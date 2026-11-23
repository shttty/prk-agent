import type { TerminalSessionContext } from "../terminal-session-state.ts";
import { pump } from "./pump.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function resizeTerminal(ctx: TerminalSessionContext, rows: number, cols: number): void {
  if (ctx.released) return;
  if (ctx.queue.length >= ctx.owner.gateway.pendingMax) {
    ctx.sink.failure(new WireError("BUSY", "Terminal input queue is full; resize was not sent."));
    return;
  }
  ctx.queue.push({ method: "terminalResize", rows, cols });
  pump(ctx);
}
