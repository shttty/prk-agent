import { receiveFrameChunk } from "./receive-frame-chunk.ts";
import { fail } from "../lifecycle/fail.ts";
import { errorOf } from "./normalize-error.ts";
import type { GenerationContext } from "../generation-types.ts";

export function observeChannel(ctx: GenerationContext): void {
    ctx.unsubscribers.push(ctx.lease.subscribe((event) => {
      if (event.mod !== "remoteExtensions" || event.generation !== ctx.generation) return;
      if (event.t !== "frameChunk") ctx.options.onEvent?.(event);
      if (event.t === "log") console.error(`[remote-extension ${ctx.generation} ${event.stream}] ${String(event.data)}`);
      if (event.t === "frameChunk") {
        try { receiveFrameChunk(ctx, event); } catch (error) { fail(ctx, errorOf(error)); }
      }
      if (event.t === "exit" && !ctx.closing) fail(ctx, new Error("Remote extension process exited; in-flight outcome is unknown."));
    }));
    ctx.unsubscribers.push(ctx.lease.onState((state) => {
      if (ctx.live && state.state !== "ok") fail(ctx, new Error(`Remote extension connection lost; in-flight outcome is unknown: ${state.error ?? state.state}`));
    }));
}
