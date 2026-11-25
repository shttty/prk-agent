import { memo } from "react";
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
import { ProcessesSection } from "./ProcessesSection.jsx";
import "@fontsource-variable/manrope/wght.css";
import "./monitor-panel.css";
/** Monitor region: memoized; its sections subscribe to the store fields they read. */
function MonitorPanel({ actions, sessionRow, mobile, place, onOpenDiff, onSelectSession }) {
  const now = useTicker();
  const { history, error, retry } = useMonitorHistory(actions, sessionRow.sessionId, sessionRow.monitor);
  const monitor = sessionRow.monitor;
  const points = (history?.machine ?? []).filter(({ at }) => at >= now - history.windowMs).map(machinePoint);
  const collector = monitor?.state;
  const note = collector === "error" ? monitor.error : collector === "stopped" && monitor.machine ? "会话休眠，显示最后一次采集。" : COLLECTOR_LABELS[collector];
  return <aside className="pi-monitor-panel" data-mobile={mobile ? "true" : undefined} aria-label="监控">
    <header className="pi-monitor-head">
      <div className="pi-monitor-title"><h2>监控</h2><span>{place}</span></div>
    </header>
    <div className="pi-monitor-card-body" id="monitor-card" data-collector={collector ?? "none"} data-session-id={sessionRow.sessionId} data-target={sessionRow.target}>
      {note && collector !== "ok" ? <InlineAlert className={collector === "error" ? "pi-monitor-error" : "pi-monitor-note"} color={collector === "error" ? "red" : "gray"} id="monitor-note" role={collector === "error" ? "alert" : "status"}>{note}</InlineAlert> : null}
      {error ? <InlineAlert className="pi-monitor-error">{error} <Button id="monitor-history-retry" size="compact-xs" variant="default" onClick={retry}>重试</Button></InlineAlert> : null}
      {history ? <MachineSection monitor={monitor} now={now} history={points} windowMs={history.windowMs} /> : null}
      <CustomSection history={history} now={now} />
      <KernelSection actions={actions} sessionRow={sessionRow} />
      <HostSection remoteHost={monitor?.remoteHost} />
      <ProcessesSection processes={monitor?.processes} truncated={monitor?.processesTruncated} />
      <ChildrenSection sessionRow={sessionRow} now={now} onSelect={onSelectSession} />
      <ChangesSection monitor={monitor} now={now} onOpen={onOpenDiff} />
    </div>
  </aside>;
}
export default memo(MonitorPanel);
