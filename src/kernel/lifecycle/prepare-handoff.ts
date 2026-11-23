import type { KernelContext } from "../kernel-state.ts";
import { stop } from "../process/stop.ts";

export function prepareHandoff(ctx: KernelContext): Promise<void> {
  if (ctx.closing) return ctx.closing;
  if (ctx.preparingHandoff) return ctx.preparingHandoff;
  ctx.handoff = true;
  const preparing = Promise.withResolvers<void>();
  ctx.preparingHandoff = preparing.promise;
  const cells = [...ctx.cells.values()];
  if (ctx.maintenance) cells.push(ctx.maintenance);
  void (async () => {
    try {
      // Preserve a truly idle generation and its namespace across owner reload.
      if (ctx.process && (ctx.process.retired || ctx.starting || ctx.replacing || cells.length)) {
        await stop(ctx, ctx.process, { cause: "handoff" });
      }
    } finally {
      // Slot release follows result freeze and synchronous receipt observers, not notification delivery.
      await Promise.allSettled([ctx.starting, ctx.replacing, ...cells.map((cell) => cell.released.promise)]);
      ctx.preparingHandoff = undefined;
    }
  })().then(preparing.resolve, preparing.reject);
  return preparing.promise;
}
