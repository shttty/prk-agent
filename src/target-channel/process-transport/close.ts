import type { ProcessTransportState } from "./transport-state.ts";

/** Never close the Connection: it belongs to the shared environment, not this pipe. */
export function close(ctx: ProcessTransportState, reason = "closed"): Promise<void> {
  if (ctx.closing) return ctx.closing;
  const completion = Promise.withResolvers<void>();
  ctx.closing = completion.promise;
  ctx.closed = reason + (ctx.stderr.length ? `\n${ctx.stderr.toString("utf8")}` : "");
  ctx.startup.reject(new Error(ctx.closed));
  ctx.lease.signal.removeEventListener("abort", ctx.retire);
  ctx.pending = [];
  ctx.pendingBytes = 0;
  ctx.process?.close();
  for (const listener of ctx.closeListeners) listener(ctx.closed);
  ctx.closeListeners.clear();
  ctx.dataListeners.clear();
  void (async () => {
    try { await ctx.process?.exited.catch(() => {}); }
    finally { await ctx.lease.release(); }
  })().then(completion.resolve, completion.reject);
  return ctx.closing;
}
