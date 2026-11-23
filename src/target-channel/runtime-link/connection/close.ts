import type { RuntimeLinkContext } from "../link-state.ts";
import { exit } from "./end-link.ts";

export function close(ctx: RuntimeLinkContext): Promise<void> {
  if (ctx.closing) return ctx.closing;
  ctx.closing = Promise.resolve().then(() => ctx.transport.close());
  if (ctx.exited === undefined && ctx.stage === "run") {
    try {
      const id = ++ctx.nextId;
      const frame = `${JSON.stringify({ id, mod: "runtime", op: "quit" })}\n`;
      ctx.window.reserve(id, Buffer.byteLength(frame));
      ctx.transport.write(frame);
    }
    catch { /* The transport is closing regardless. */ }
  }
  exit(ctx, "Target channel stopped.");
  return ctx.closing;
}
