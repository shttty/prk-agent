import { request } from "../requests/request.ts";
import type { GenerationContext } from "../generation-types.ts";

export function close(ctx: GenerationContext, reason = "quit"): Promise<void> {
    if (ctx.closing) return ctx.closing;
    const failed = ctx.failure !== undefined;
    ctx.closing = (async () => {
      const started = ctx.live;
      for (const pending of [...ctx.pending.values()]) if (pending.method === "event") pending.abort(new Error("Remote extension generation is closing."));
      for (const controller of ctx.reverse.values()) controller.abort(new Error("Remote extension generation is closing."));
      try {
        if (ctx.live && !ctx.failure) await request(ctx, "shutdown", { reason });
      } finally {
        ctx.live = false;
        ctx.incomingFrame = undefined;
        ctx.context = undefined;
        for (const unsubscribe of ctx.unsubscribers) unsubscribe();
        try {
          // A lost channel must not wait for/recreate a generation on a replacement connection.
          if (started && ctx.lease.state().state === "ok") await ctx.lease.request("remoteExtensions", "stop", { generation: ctx.generation });
        } finally {
          const error = ctx.failure ?? new Error("Remote extension generation is closed.");
          ctx.failure = error;
          for (const pending of ctx.pending.values()) pending.reject(error);
          for (const controller of ctx.reverse.values()) controller.abort(error);
          for (const timer of ctx.abortAcks.values()) clearTimeout(timer);
          ctx.abortAcks.clear();
          await ctx.lease.release();
          if (!failed) ctx.options.onMonitor?.(null);
        }
      }
    })();
    return ctx.closing;
}
