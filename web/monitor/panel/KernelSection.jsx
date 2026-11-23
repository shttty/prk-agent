import { useState } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { useStopTarget } from "../../workbench/subscription/use-stop-target.js";
import { kernelMemory } from "../readings/kernel-memory.js";
import { enc } from "./monitor-panel-constants.js";
import { KERNEL_LABELS } from "./monitor-panel-constants.js";
import { alertsOf } from "../readings/alerts-of.js";
import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { formatBytes } from "../readings/format-bytes.js";
import { IconRefresh } from "@tabler/icons-react";
import { IconPlayerStop } from "@tabler/icons-react";
import { IconEraser } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
export function KernelSection({ actions, sessionRow }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const live = useWorkbench((state) => state.selectedSessionId === sessionRow.sessionId);
  const liveState = useWorkbench((state) => state.session.snapshot?.state);
  const liveKernel = useWorkbench((state) => state.session.snapshot?.kernel);
  const kernel = live ? liveKernel ?? sessionRow.kernel : sessionRow.kernel;
  const memory = kernelMemory(kernel);
  const sessionState = live ? liveState ?? sessionRow.state : sessionRow.state;
  const maintainable = sessionState === "idle" && kernel?.state === "idle" && kernel?.connectionStatus === "connected";
  const stopTarget = useStopTarget();
  const connected = useWorkbench((state) => state.session.connection === "connected" && !state.session.pending.has("stopping"));
  const running = live && connected && Boolean(stopTarget);
  const act = async (name, run) => {
    setBusy(name);
    setError("");
    try { await run(); } catch (failure) { setError(failure instanceof Error ? failure.message : "操作失败。"); } finally { setBusy(""); }
  };
  const post = (action) => () => actions.api.post(`/sessions/${enc(sessionRow.sessionId)}/kernel/${action}`, {});
  // Anything but a running kernel has no live memory: what is shown is the last reading taken before it went away.
  const stale = kernel?.state !== "idle" && kernel?.state !== "busy";
  const memoryAlert = alertsOf(sessionRow).memory;
  return <section className="pi-monitor-section" id="monitor-kernel" data-status={kernel?.state ?? "none"} aria-label="Kernel">
    <h3>Kernel <Badge component="span" variant="light" color={kernel?.state === "busy" ? "accent" : kernel?.state === "unavailable" || kernel?.state === "failed" ? "red" : "gray"} size="xs" tt="none" className="pi-monitor-chip-state" data-status={kernel?.state ?? "none"}>{KERNEL_LABELS[kernel?.state] ?? "—"}</Badge></h3>
    <div className="pi-monitor-meter-row">
      <span id="monitor-kernel-memory">{memory ? <span className="pi-monitor-meter-value" data-used-bytes={memory.used} data-percent={memory.percent === null ? undefined : Math.round(memory.percent)} data-stale={stale ? "true" : undefined} data-alert={memoryAlert ? "true" : undefined}>{formatBytes(memory.used)}{memory.limit ? ` / ${formatBytes(memory.limit)}` : ""}{stale ? "（最后读数）" : ""}</span> : <span className="pi-monitor-meter-value">—</span>}</span>
      <span className="pi-monitor-oom" id="monitor-kernel-oom"><span data-count={memory?.oomKill ?? 0} data-stale={stale && memory ? "true" : undefined} data-alert={memory?.oomKill > 0 ? "true" : undefined}>OOM {memory?.oomKill ?? 0} 次</span></span>
    </div>
    {memory?.percent !== null && memory?.percent !== undefined ? <div className="pi-monitor-meter" data-alert={memoryAlert ? "true" : undefined} data-stale={stale ? "true" : undefined}><i style={{ width: `${Math.min(100, memory.percent)}%` }} /></div> : null}
    <div className="pi-monitor-actions">
      <Button id="monitor-kernel-restart" size="compact-xs" variant="default" leftSection={<IconRefresh size={13} />} disabled={!maintainable || Boolean(busy)} loading={busy === "restart"} onClick={() => void act("restart", post("restart"))}>重启</Button>
      <Button id="monitor-kernel-interrupt" size="compact-xs" variant="default" leftSection={<IconPlayerStop size={13} />} disabled={!running || Boolean(busy)} loading={busy === "interrupt"} onClick={() => void act("interrupt", () => actions.cancelOperation(stopTarget))}>中断</Button>
      <Button id="monitor-kernel-clear" size="compact-xs" variant="default" leftSection={<IconEraser size={13} />} disabled={!maintainable || Boolean(busy)} loading={busy === "clear"} onClick={() => void act("clear", post("clear"))}>清空变量</Button>
    </div>
    {error ? <InlineAlert className="pi-monitor-error">{error}</InlineAlert> : null}
  </section>;
}
