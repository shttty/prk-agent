import { memo } from "react";
import { layout } from "../../shell/layout/layout-store.js";
import { useLayout } from "../../shell/layout/use-layout.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { childSessions } from "../readings/child-sessions.js";
import { MonitorBlock } from "./MonitorBlock.jsx";
import { MonitorOverview } from "./MonitorOverview.jsx";
import { ProcessesSection } from "./ProcessesSection.jsx";
import { useTicker } from "./use-ticker.js";
import useMonitorHistory from "./use-monitor-history.js";
import { machinePoint } from "../readings/machine-point.js";
import { COLLECTOR_LABELS } from "./monitor-panel-constants.js";
import { Button } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { MachineSection } from "./MachineSection.jsx";
import { CustomSection } from "./CustomSection.jsx";
import { KernelSection } from "./KernelSection.jsx";
import { ChangesSection } from "./ChangesSection.jsx";
import { HostSection } from "./HostSection.jsx";
import { ChildrenSection } from "./ChildrenSection.jsx";
import "@fontsource-variable/manrope/wght.css";
import "./monitor-panel.css";
/** Monitor region: memoized; its sections subscribe to the store fields they read. */
function MonitorPanel({ actions, sessionRow, mobile, place, onOpenDiff, onSelectSession }) {
  const now = useTicker();
  const { history, error, retry } = useMonitorHistory(actions, sessionRow.sessionId, sessionRow.monitor);
  const monitor = sessionRow.monitor;
  const sections = new Set(useLayout().monitorOpenBlocks.split(","));
  const toggle = (name) => {
    const open = new Set(layout.get().monitorOpenBlocks.split(",").filter(Boolean));
    if (open.has(name)) open.delete(name);
    else open.add(name);
    layout.set({ monitorOpenBlocks: [...open].join(",") });
  };
  const sessions = useWorkbench((state) => state.sessions);
  const targets = useWorkbench((state) => state.targets);
  const kernel = useWorkbench((state) => state.selectedSessionId === sessionRow.sessionId ? state.session.snapshot?.kernel : undefined) ?? sessionRow.kernel;
  const children = childSessions(sessions, sessionRow.sessionId, targets);
  const processes = monitor?.processes ?? [];
  const points = sections.has("machine") ? (history?.machine ?? []).filter(({ at }) => at >= now - history.windowMs).map(machinePoint) : [];
  const collector = monitor?.state;
  const note = collector === "error" ? monitor.error : collector === "stopped" && monitor.machine ? "会话休眠，显示最后一次采集。" : COLLECTOR_LABELS[collector];
  return <aside className="pi-monitor-panel" data-mobile={mobile ? "true" : undefined} aria-label="监控">
    <header className="pi-monitor-head">
      <div className="pi-monitor-title"><h2>监控</h2><span>{place}</span></div>
    </header>
    <div className="pi-monitor-card-body" id="monitor-card" data-collector={collector ?? "none"} data-session-id={sessionRow.sessionId} data-target={sessionRow.target}>
      {note && collector !== "ok" ? <InlineAlert className={collector === "error" ? "pi-monitor-error" : "pi-monitor-note"} color={collector === "error" ? "red" : "gray"} id="monitor-note" role={collector === "error" ? "alert" : "status"}>{note}</InlineAlert> : null}
      {error ? <InlineAlert className="pi-monitor-error">{error} <Button id="monitor-history-retry" size="compact-xs" variant="default" onClick={retry}>重试</Button></InlineAlert> : null}
      <MonitorOverview monitor={monitor} kernel={kernel} children={children} processes={processes} />
      <div className="pi-monitor-blocks">
        <MonitorBlock name="machine" label="主机曲线" open={sections.has("machine")} toggle={toggle}>
          {history ? <MachineSection monitor={monitor} now={now} history={points} windowMs={history.windowMs} /> : <div className="pi-monitor-section pi-monitor-empty">暂无采集历史。</div>}
          <CustomSection history={history} now={now} />
        </MonitorBlock>
        <MonitorBlock name="kernel" label="Kernel" open={sections.has("kernel")} toggle={toggle}>
          <KernelSection actions={actions} sessionRow={sessionRow} />
          <HostSection remoteHost={monitor?.remoteHost} />
        </MonitorBlock>
        <MonitorBlock name="processes" label="后台进程" open={sections.has("processes")} toggle={toggle}>
          <ProcessesSection processes={processes} truncated={monitor?.processesTruncated} />
        </MonitorBlock>
        <MonitorBlock name="children" label="子会话" open={sections.has("children")} toggle={toggle}>
          <ChildrenSection children={children} now={now} onSelect={onSelectSession} />
        </MonitorBlock>
        <MonitorBlock name="changes" label="改动" open={sections.has("changes")} toggle={toggle}>
          <ChangesSection monitor={monitor} now={now} onOpen={onOpenDiff} />
        </MonitorBlock>
      </div>
    </div>
  </aside>;
}
export default memo(MonitorPanel);
