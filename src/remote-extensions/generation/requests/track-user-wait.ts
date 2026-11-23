import type { RequestContext } from "../generation-types.ts";
import { scheduleControlDeadline } from "./schedule-control-deadline.ts";

export function trackUserWait(ctx: RequestContext, start: boolean): void {
  ctx.userWaits += start ? 1 : -1;
  clearTimeout(ctx.timer);
  if (ctx.userWaits === 0 && ctx.generation.pending.has(ctx.id)) ctx.timer = scheduleControlDeadline(ctx);
}
