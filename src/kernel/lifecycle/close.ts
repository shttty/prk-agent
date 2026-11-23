import type { KernelContext } from "../kernel-state.ts";
import { stop } from "../process/stop.ts";
import { publish } from "../telemetry/publish.ts";

export function close(ctx: KernelContext): Promise<void> {
  if (ctx.closing) return ctx.closing;
  const closing = Promise.withResolvers<void>();
  ctx.closing = closing.promise;
  ctx.closed = true;
  const releases = [ctx.starting, ctx.replacing, ctx.maintenance?.released.promise,
    ...Array.from(ctx.cells.values(), (cell) => cell.released.promise)];
  void (async () => {
    try {
      if (ctx.process) await stop(ctx, ctx.process, { cause: "close" });
      else publish(ctx, { state: "closing" });
    } finally {
      await Promise.allSettled(releases);
      publish(ctx, { state: "closed", connectionStatus: "disconnected" });
    }
  })().then(closing.resolve, closing.reject);
  return ctx.closing;
}
