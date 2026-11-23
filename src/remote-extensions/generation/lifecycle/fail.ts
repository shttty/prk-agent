import { publishMonitor } from "../telemetry/publish-monitor.ts";
import { close } from "./close.ts";
import type { GenerationContext } from "../generation-types.ts";

export function fail(ctx: GenerationContext, error: Error): void {
    if (ctx.failure) return;
    ctx.failure = error;
    ctx.incomingFrame = undefined;
    publishMonitor(ctx, "failed", error);
    try { ctx.options.onError?.(error); }
    finally {
      for (const pending of ctx.pending.values()) pending.reject(error);
      for (const controller of ctx.reverse.values()) controller.abort(error);
      // Killing this generation never affects a different session's lease/process.
      void close(ctx, "disconnect").catch(() => {});
    }
}
