import type { Ref } from "react";
import { Flex, UnstyledButton, type FlexProps } from "@mantine/core";
import { alertsOf } from "../readings/alerts-of.ts";
import { deltaLabel } from "../readings/delta-label.ts";
import { machineFacts } from "../readings/machine-facts.ts";
import type { MonitoredRow } from "../readings/monitor-types.ts";
import "./monitor-button.css";

type MonitorPillProps = FlexProps & { sessionRow: MonitoredRow; opened: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> };

/** Desktop monitor pill. `ref` and the other props come from the popover target it anchors (the panel). */
export function MonitorPill({ sessionRow, opened, onToggle, ref, ...anchor }: MonitorPillProps) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  const facts = machineFacts(sessionRow.monitor?.machine);
  return <Flex component={UnstyledButton} {...anchor} ref={ref} id="toggle-monitor" className="pi-monitor-pill" align="center" gap={10} h={26} px={11} aria-label="监控" title="监控" aria-pressed={opened} data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined} onClick={onToggle}>
    {alerts.any ? <span className="pi-monitor-dot" aria-hidden="true" /> : null}
    {facts.length ? facts.map(([label, value]) => <Flex component="span" key={label} align="baseline" gap={4} className="pi-monitor-pill-fact"><span>{label}</span><b>{value ?? "—"}</b>{value !== null ? "%" : ""}</Flex>) : <span className="pi-monitor-pill-fact"><span>监控</span></span>}
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </Flex>;
}
