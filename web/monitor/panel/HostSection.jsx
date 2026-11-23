import { Badge } from "@mantine/core";
import { hostMemory } from "../readings/host-memory.js";
import { formatBytes } from "../readings/format-bytes.js";
export const HOST_LABELS = { running: "运行中", replacing: "换代中", failed: "已退出" };

/** The session's plugin host on the target (monitor.remoteHost): state and working set against its scope limit. Absent
 * when the session has no remote host (local session, no target plugins). */
export function HostSection({ remoteHost }) {
  if (!remoteHost) return null;
  const memory = hostMemory(remoteHost);
  return <section className="pi-monitor-section" id="monitor-host" data-status={remoteHost.state} data-scoped={typeof remoteHost.scoped === "boolean" ? String(remoteHost.scoped) : undefined} aria-label="插件宿主">
    <h3>插件宿主 <Badge component="span" variant="light" color={remoteHost.state === "failed" ? "red" : "gray"} size="xs" tt="none" className="pi-monitor-chip-state" data-status={remoteHost.state}>{HOST_LABELS[remoteHost.state] ?? "—"}</Badge></h3>
    <div className="pi-monitor-meter-row">
      <span id="monitor-host-memory">{memory ? <span className="pi-monitor-meter-value" data-used-bytes={memory.used} data-limit-bytes={memory.limit ?? undefined}>{formatBytes(memory.used)}{memory.limit ? ` / ${formatBytes(memory.limit)}` : ""}</span> : <span className="pi-monitor-meter-value">—</span>}</span>
      {memory ? <span className="pi-monitor-oom"><span data-count={memory.oomKill} data-alert={memory.oomKill > 0 ? "true" : undefined}>OOM {memory.oomKill} 次</span></span> : null}
    </div>
    {memory?.percent !== null && memory?.percent !== undefined ? <div className="pi-monitor-meter"><i style={{ width: `${Math.min(100, memory.percent)}%` }} /></div> : null}
    {remoteHost.error ? <span className="pi-monitor-age" role="alert">{remoteHost.error}</span> : null}
  </section>;
}
