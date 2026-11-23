import type { MonitorContext } from "./monitor-state.ts";
import type { SessionMonitor, SessionChanges } from "./session-monitor-types.ts";

export function view(ctx: MonitorContext, sessionId: string): SessionMonitor | undefined {
  const rec = ctx.sessions.get(sessionId);
  if (!rec) return undefined;
  const machine = rec.machine === undefined ? undefined : ctx.machines.get(rec.machine);
  const at = ctx.now();
  const dir = rec.dir && rec.dir.value.git ? rec.dir : undefined;
  const changes: SessionChanges | undefined = dir
    ? { source: "git", added: dir.value.added, removed: dir.value.removed, files: dir.value.files, truncated: dir.value.truncated,
        ...(dir.value.error === null ? {} : { error: dir.value.error }), ageMs: at - dir.at }
    : rec.agent ? { source: "agent", added: rec.agent.value.added, removed: rec.agent.value.removed, files: rec.agent.value.files,
        truncated: false, ageMs: at - rec.agent.at, gitUnavailable: rec.dir?.value.unavailable === true,
        ...(rec.dir?.value.reason ? { gitReason: rec.dir.value.reason } : {}) }
    : undefined;
  // The machine card shows the disk of the session's own cwd when the collector reported one.
  const disk = rec.dir?.value.disk ?? rec.sample?.value.disk ?? null;
  return {
    state: machine?.state ?? "stopped",
    ...(machine?.error === undefined ? {} : { error: machine.error }),
    ...(machine?.intervalMs === undefined ? {} : { intervalMs: machine.intervalMs }),
    alerts: rec.alerts,
    ...(rec.sample ? { machine: { ...rec.sample.value, disk, ageMs: at - rec.sample.at, sampledAt: rec.sample.at } } : {}),
    customMetrics: ctx.machines.get(rec.historyMachine ?? "")?.custom.view() ?? [],
    remoteHost: rec.remoteHost === null ? null : { ...rec.remoteHost, ...(rec.remoteHost.sampledAt === undefined ? {} : { ageMs: Math.max(0, at - rec.remoteHost.sampledAt) }) },
    ...(changes ? { changes } : {}),
  };
}
