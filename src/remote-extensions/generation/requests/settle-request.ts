import type { RequestContext } from "../generation-types.ts";

export function settleRequest(ctx: RequestContext, error?: Error, value?: unknown): void {
  if (!ctx.generation.pending.delete(ctx.id)) return;
  clearTimeout(ctx.timer);
  ctx.hooks.signal?.removeEventListener("abort", ctx.onAbort);
  if (error) ctx.result.reject(error); else ctx.result.resolve(value);
}
