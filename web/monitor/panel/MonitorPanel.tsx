import { memo } from "react";
import { Button, Flex, Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import type { SelectedRow } from "../../workbench/store/store-types.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { machinePoint } from "../readings/machine-point.ts";
import { ChangesSection } from "./ChangesSection.tsx";
import { ChildrenSection } from "./ChildrenSection.tsx";
import { CustomSection } from "./CustomSection.tsx";
import { HostSection } from "./HostSection.tsx";
import { KernelSection } from "./KernelSection.tsx";
import { MachineSection } from "./MachineSection.tsx";
import { ProcessesSection } from "./ProcessesSection.tsx";
import { COLLECTOR_LABELS } from "./monitor-panel-constants.ts";
import useMonitorHistory from "./use-monitor-history.ts";
import { useTicker } from "./use-ticker.ts";
import "@fontsource-variable/manrope/wght.css";
import "./monitor-panel.css";

type MonitorPanelProps = { actions: WorkbenchActions; sessionRow: SelectedRow; mobile?: boolean; place: string; onOpenDiff: (path: string) => void; onSelectSession?: (sessionId: string) => void };

/** Monitor region: memoized; its sections subscribe to the store fields they read. */
function MonitorPanel({ actions, sessionRow, mobile, place, onOpenDiff, onSelectSession }: MonitorPanelProps) {
  const now = useTicker();
  const { history, error, retry } = useMonitorHistory(actions, sessionRow.sessionId, sessionRow.monitor);
  const monitor = sessionRow.monitor;
  const points = history ? history.machine.filter(({ at }) => at >= now - history.windowMs).map(machinePoint) : [];
  const collector = monitor?.state;
  const note = collector === "error" ? monitor?.error : collector === "stopped" && monitor?.machine ? "会话休眠，显示最后一次采集。" : collector && COLLECTOR_LABELS[collector];
  return <Flex component="aside" direction="column" className="pi-monitor-panel" data-mobile={mobile ? "true" : undefined} aria-label="监控">
    <Flex component="header" align="baseline" gap={8} flex="none" pt={11} pr={8} pb={4} pl={14}>
      <h2 className="pi-monitor-title">监控</h2>
      <Text component="span" truncate="end" c="var(--pi-muted)" fz={11.5}>{place}</Text>
    </Flex>
    <Flex direction="column" className="pi-monitor-card-body" id="monitor-card" data-collector={collector ?? "none"} data-session-id={sessionRow.sessionId} data-target={sessionRow.target}>
      {note && collector !== "ok" ? <InlineAlert className={collector === "error" ? "pi-monitor-error" : "pi-monitor-note"} color={collector === "error" ? "red" : "gray"} id="monitor-note" role={collector === "error" ? "alert" : "status"}>{note}</InlineAlert> : null}
      {error ? <InlineAlert className="pi-monitor-error">{error} <Button id="monitor-history-retry" size="compact-xs" variant="default" onClick={retry}>重试</Button></InlineAlert> : null}
      {history ? <MachineSection monitor={monitor} now={now} history={points} windowMs={history.windowMs} /> : null}
      <CustomSection history={history} now={now} />
      <KernelSection actions={actions} sessionRow={sessionRow} />
      <HostSection remoteHost={monitor?.remoteHost} />
      <ProcessesSection processes={monitor?.processes} truncated={monitor?.processesTruncated} />
      <ChildrenSection sessionId={sessionRow.sessionId} now={now} onSelect={onSelectSession} />
      <ChangesSection monitor={monitor} now={now} onOpen={onOpenDiff} />
    </Flex>
  </Flex>;
}
export default memo(MonitorPanel);
