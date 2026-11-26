import { Badge, Group } from "@mantine/core";
import type { RemoteHostMonitor } from "../../../src/gateway/wire/web-types.ts";
import { kernelMemory } from "../readings/kernel-memory.ts";
import { formatBytes } from "../readings/format-bytes.ts";
import { MemoryMeter } from "./MemoryMeter.tsx";
import { SectionTitle } from "./SectionTitle.tsx";

const HOST_LABELS = { running: "运行中", replacing: "换代中", failed: "已退出" };

/** The session's plugin host on the target (monitor.remoteHost): state and working set against its scope limit. Absent
 * when the session has no remote host (local session, no target plugins). */
export function HostSection({ remoteHost }: { remoteHost: RemoteHostMonitor | null | undefined }) {
  if (!remoteHost) return null;
  const memory = kernelMemory(remoteHost.memory);
  return <section className="pi-monitor-section" id="monitor-host" data-status={remoteHost.state} data-scoped={typeof remoteHost.scoped === "boolean" ? String(remoteHost.scoped) : undefined} aria-label="插件宿主">
    <SectionTitle>插件宿主 <Badge component="span" variant="light" color={remoteHost.state === "failed" ? "red" : "gray"} size="xs" tt="none" flex="none" data-status={remoteHost.state}>{HOST_LABELS[remoteHost.state] ?? "—"}</Badge></SectionTitle>
    <Group justify="space-between" align="baseline" gap={8} className="pi-monitor-meter-row">
      <span id="monitor-host-memory">{memory ? <span className="pi-monitor-meter-value" data-used-bytes={memory.used} data-limit-bytes={memory.limit ?? undefined}>{formatBytes(memory.used)}{memory.limit ? ` / ${formatBytes(memory.limit)}` : ""}</span> : <span className="pi-monitor-meter-value">—</span>}</span>
      {memory ? <span className="pi-monitor-oom"><span data-count={memory.oomKill} data-alert={memory.oomKill > 0 ? "true" : undefined}>OOM {memory.oomKill} 次</span></span> : null}
    </Group>
    {memory?.percent != null ? <MemoryMeter percent={memory.percent} /> : null}
    {remoteHost.error ? <span className="pi-monitor-age" role="alert">{remoteHost.error}</span> : null}
  </section>;
}
