import type { HostContext } from "../host/host-state.ts";
import { createMonitorService } from "../../monitor/session-monitor/assemble-session-monitor.ts";
import { agentChanges } from "../../monitor/agent-edits/agent-changes.ts";
import { processRoots } from "./process-roots.ts";
import { agentDiff } from "../../monitor/agent-edits/agent-diff.ts";

export function openMonitor(ctx: HostContext): void {
  ctx.monitoring.monitor = createMonitorService({
    options: ctx.host.config.monitor,
    channels: ctx.host.channels,
    processRoots: processRoots.bind(undefined, ctx),
    onDetachedChanged: (sessionId, detached) => {
      const entry = ctx.host.history.get(sessionId);
      const attention = ctx.host.collection.get(sessionId)?.host.attention;
      if (!entry || entry.sleeping || entry.archived || !attention || attention.background) return;
      ctx.methods.publish("session_attention_changed", entry, { ...attention, background: detached });
    },
    customMetrics: (instance) => ctx.instances.targets.find((target) => target.id === instance)?.customMetrics ?? [],
    agentChanges: (sessionId) => agentChanges(ctx.methods.branchOf(sessionId)),
    agentDiff: (sessionId, path) => agentDiff(ctx.methods.branchOf(sessionId), path),
    log: (message) => console.error(`[${new Date().toISOString()}] Gateway ${message}`),
  });
  ctx.monitoring.unsubscribeMonitor = ctx.monitoring.monitor.subscribe((sessionId, value) => {
    const entry = ctx.host.history.get(sessionId);
    if (entry && !entry.archived) ctx.methods.publish("session_monitor", entry, { monitor: value });
  });
}
