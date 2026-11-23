import type { ProcessTransportState } from "./transport-state.ts";

export function subscribeData(ctx: ProcessTransportState, listener: (data: string) => void): void {
  if (ctx.closed !== undefined) return;
  ctx.dataListeners.add(listener);
  const pending = ctx.pending;
  ctx.pending = [];
  ctx.pendingBytes = 0;
  for (const text of pending) listener(text);
}
