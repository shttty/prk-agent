import { useState } from "react";
import { Badge, Button, Group } from "@mantine/core";
import { IconEraser, IconPlayerStop, IconRefresh } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import type { KernelSnapshot } from "../../../src/gateway/wire/web-types.ts";
import type { SelectedRow } from "../../workbench/store/store-types.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { useStopTarget } from "../../workbench/subscription/use-stop-target.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { alertsOf } from "../readings/alerts-of.ts";
import { formatBytes } from "../readings/format-bytes.ts";
import { kernelMemory } from "../readings/kernel-memory.ts";
import { MemoryMeter } from "./MemoryMeter.tsx";
import { SectionTitle } from "./SectionTitle.tsx";
import { KERNEL_LABELS, enc } from "./monitor-panel-constants.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

type KernelSectionProps = { actions: WorkbenchActions; sessionRow: SelectedRow };

export function KernelSection({ actions, sessionRow }: KernelSectionProps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const live = useWorkbench((state: WorkbenchState) => state.selectedSessionId === sessionRow.sessionId);
  const liveState = useWorkbench((state: WorkbenchState) => state.session.snapshot?.state);
  const liveKernel: KernelSnapshot | undefined = useWorkbench((state: WorkbenchState) => state.session.snapshot?.kernel);
  const kernel = live ? liveKernel ?? sessionRow.kernel : sessionRow.kernel;
  const memory = kernelMemory(kernel?.memory);
  const sessionState = live ? liveState ?? sessionRow.state : sessionRow.state;
  const maintainable = sessionState === "idle" && kernel?.state === "idle" && kernel.connectionStatus === "connected";
  const stopTarget = useStopTarget();
  const connected = useWorkbench((state: WorkbenchState) => state.session.connection === "connected" && !state.session.pending.has("stopping"));
  const running = live && connected && Boolean(stopTarget);
  const act = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name);
    setError("");
    try { await run(); } catch (failure) { setError(failure instanceof Error ? failure.message : "操作失败。"); } finally { setBusy(""); }
  };
  const post = (action: string) => () => actions.api.post(`/sessions/${enc(sessionRow.sessionId)}/kernel/${action}`, {});
  // Anything but a running kernel has no live memory: what is shown is the last reading taken before it went away.
  const stale = kernel?.state !== "idle" && kernel?.state !== "busy";
  const memoryAlert = alertsOf(sessionRow).memory;
  const kernelState = kernel?.state ?? "none";
  return <section className="pi-monitor-section" id="monitor-kernel" data-status={kernelState} aria-label="Kernel">
    <SectionTitle>Kernel <Badge component="span" variant="light" color={kernelState === "busy" ? "accent" : kernelState === "unavailable" || kernelState === "failed" ? "red" : "gray"} size="xs" tt="none" flex="none" data-status={kernelState}>{KERNEL_LABELS[kernelState] ?? "—"}</Badge></SectionTitle>
    <Group justify="space-between" align="baseline" gap={8} className="pi-monitor-meter-row">
      <span id="monitor-kernel-memory">{memory ? <span className="pi-monitor-meter-value" data-used-bytes={memory.used} data-percent={memory.percent === null ? undefined : Math.round(memory.percent)} data-stale={stale ? "true" : undefined} data-alert={memoryAlert ? "true" : undefined}>{formatBytes(memory.used)}{memory.limit ? ` / ${formatBytes(memory.limit)}` : ""}{stale ? "（最后读数）" : ""}</span> : <span className="pi-monitor-meter-value">—</span>}</span>
      <span className="pi-monitor-oom" id="monitor-kernel-oom"><span data-count={memory?.oomKill ?? 0} data-stale={stale && memory ? "true" : undefined} data-alert={memory && memory.oomKill > 0 ? "true" : undefined}>OOM {memory?.oomKill ?? 0} 次</span></span>
    </Group>
    {memory?.percent != null ? <MemoryMeter percent={memory.percent} alert={memoryAlert} stale={stale} /> : null}
    <Group gap={6} mt={9} className="pi-monitor-actions">
      <Button id="monitor-kernel-restart" size="compact-xs" variant="default" leftSection={<IconRefresh size={13} />} disabled={!maintainable || Boolean(busy)} loading={busy === "restart"} onClick={() => void act("restart", post("restart"))}>重启</Button>
      <Button id="monitor-kernel-interrupt" size="compact-xs" variant="default" leftSection={<IconPlayerStop size={13} />} disabled={!running || Boolean(busy)} loading={busy === "interrupt"} onClick={() => void act("interrupt", () => actions.cancelOperation(stopTarget))}>中断</Button>
      <Button id="monitor-kernel-clear" size="compact-xs" variant="default" leftSection={<IconEraser size={13} />} disabled={!maintainable || Boolean(busy)} loading={busy === "clear"} onClick={() => void act("clear", post("clear"))}>清空变量</Button>
    </Group>
    {error ? <InlineAlert className="pi-monitor-error">{error}</InlineAlert> : null}
  </section>;
}
