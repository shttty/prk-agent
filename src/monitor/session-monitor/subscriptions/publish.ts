import type { MonitorContext } from "../monitor-state.ts";
import { view } from "../read-view.ts";

export function publish(ctx: MonitorContext, sessionId: string): void {
  const monitor = view(ctx, sessionId);
  if (!monitor) return;
  for (const listener of [...ctx.listeners]) {
    try { listener(sessionId, monitor); } catch { ctx.log("monitor listener failed"); }
  }
}
