import { errorOf } from "../../connection-error/normalize-error.ts";
import type { RuntimeLinkContext } from "../link-state.ts";
import { close } from "./close.ts";
import { exit } from "./end-link.ts";
import { line } from "./receive-line.ts";

export async function start(ctx: RuntimeLinkContext, command: string, signal: AbortSignal): Promise<void> {
  const abort = (): void => { void close(ctx).catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  ctx.startTimer = setTimeout(() => exit(ctx, "Target channel start timed out."), ctx.timeoutMs);
  try {
    ctx.transport.onData((data) => {
      if (ctx.exited !== undefined) return;
      ctx.pending += data;
      let newline: number;
      while ((newline = ctx.pending.indexOf("\n")) >= 0) {
        const text = ctx.pending.slice(0, newline);
        ctx.pending = ctx.pending.slice(newline + 1);
        if (Buffer.byteLength(text) + 1 > ctx.limits.maxFrameBytes) {
          exit(ctx, "Target process frame exceeds byte limit");
          return;
        }
        line(ctx, text);
      }
      if (Buffer.byteLength(ctx.pending) >= ctx.limits.maxFrameBytes) exit(ctx, "Target process frame exceeds byte limit");
    });
    ctx.transport.onClose((reason) => exit(ctx, reason));
    if (signal.aborted) abort();
    else if (command) {
      try { ctx.transport.write(command); }
      catch (error) { exit(ctx, errorOf(error).message); }
    }
    await ctx.handshake.promise;
  } catch (error) {
    await close(ctx).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(ctx.startTimer);
    signal.removeEventListener("abort", abort);
  }
}
