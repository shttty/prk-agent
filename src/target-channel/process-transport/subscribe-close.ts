import type { ProcessTransportState } from "./transport-state.ts";

export function subscribeClose(ctx: ProcessTransportState, listener: (reason: string) => void): void {
  if (ctx.closed !== undefined) listener(ctx.closed);
  else ctx.closeListeners.add(listener);
}
