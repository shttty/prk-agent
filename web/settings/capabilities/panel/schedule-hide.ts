import type { CapabilityCtx } from "../capability-types.ts";

export function scheduleHide(ctx: Pick<CapabilityCtx, "timers" | "peekRef" | "hidePeek">) {
  const { timers, peekRef, hidePeek } = ctx;
  clearTimeout(timers.current.hide);
  if (!peekRef.current?.pinned) timers.current.hide = setTimeout(hidePeek, 140);
}
