import type { MonitorContext } from "./monitor-state.ts";
import type { SessionMonitor } from "./session-monitor-types.ts";

export function subscribe(ctx: MonitorContext, listener: (sessionId: string, monitor: SessionMonitor) => void): () => void {
    ctx.listeners.add(listener);
    return () => { ctx.listeners.delete(listener); };
  }
