import type { HostContext } from "../../host/host-state.ts";
import type { MonitoredSession } from "../../../monitor/session-monitor/session-monitor-types.ts";

export function reconcileMonitor(ctx: HostContext): void {
    if (ctx.monitoring.monitorQueued || ctx.lifecycle.closing) return;
    ctx.monitoring.monitorQueued = true;
    queueMicrotask(() => {
      ctx.monitoring.monitorQueued = false;
      if (ctx.lifecycle.closing) return;
      const live = new Map(ctx.host.collection.snapshot().map((session) => [session.sessionId, session.state]));
      const awake = ctx.host.history.listAll().flatMap((entry): MonitoredSession[] => {
        if (entry.sleeping) return [];
        const state = live.get(entry.sessionId);
        if (state === undefined || state === "closed" || state === "closing") return [];
        return [{ sessionId: entry.sessionId, machine: entry.target, cwd: entry.cwd }];
      });
      ctx.monitoring.monitor.setSessions(awake);
      const awakeNames = new Set(awake.map((session) => session.sessionId));
      for (const [sessionId, watch] of ctx.monitoring.kernelWatches) {
        if (awakeNames.has(sessionId) && ctx.host.collection.get(sessionId)?.kernel === watch.kernel) continue;
        watch.unsubscribe();
        ctx.monitoring.kernelWatches.delete(sessionId);
        if (!awakeNames.has(sessionId)) ctx.monitoring.monitor.reportKernel(sessionId, undefined);
      }
      for (const session of awake) {
        const kernel = ctx.host.collection.get(session.sessionId)?.kernel;
        if (!kernel || ctx.monitoring.kernelWatches.has(session.sessionId)) continue;
        ctx.monitoring.kernelWatches.set(session.sessionId, { kernel, unsubscribe: kernel.subscribe((snapshot) => ctx.monitoring.monitor.reportKernel(session.sessionId, snapshot)) });
        ctx.monitoring.monitor.reportKernel(session.sessionId, kernel.getSnapshot());
      }
    });
  }
