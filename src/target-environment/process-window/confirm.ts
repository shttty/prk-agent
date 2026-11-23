import { CONTROL_CONSUMED, type ProcessWindowState } from "./window-state.ts";

export function confirm(ctx: ProcessWindowState, id: number): void {
  const entry = ctx.pending.get(id);
  if (entry === undefined) return;
  ctx.pending.delete(id);
  if (typeof entry === "number") {
    ctx.ordinaryRequests--;
    ctx.ordinaryBytes -= entry;
  } else {
    const receipt = entry.receipt;
    entry.bytes = 0;
    entry.receipt = undefined;
    receipt?.abort(CONTROL_CONSUMED);
  }
}
