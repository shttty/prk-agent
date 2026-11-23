import type { ProcessWindowState } from "./window-state.ts";

export function retire(ctx: ProcessWindowState, reason?: unknown): void {
  ctx.retired = true;
  ctx.pending.clear();
  if (ctx.controls) for (const slot of ctx.controls.values()) slot.receipt?.abort(reason);
  ctx.controls?.clear();
  ctx.ordinaryRequests = 0;
  ctx.ordinaryBytes = 0;
}
