import { ActionIcon, Indicator } from "@mantine/core";
import { IconActivity } from "@tabler/icons-react";
import { alertsOf } from "../readings/alerts-of.ts";
import { deltaLabel } from "../readings/delta-label.ts";
import type { MonitoredRow } from "../readings/monitor-types.ts";
import "./monitor-button.css";

type MonitorButtonProps = { sessionRow: MonitoredRow; opened: boolean; onToggle: () => void };

/** Phone monitor button: the icon grows to the right when it carries a `+N`. */
export default function MonitorButton({ sessionRow, opened, onToggle }: MonitorButtonProps) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  return <ActionIcon id="toggle-monitor" className="pi-monitor-toggle" variant={opened ? "light" : "subtle"} color="gray" size="lg" aria-label="监控" title="监控" aria-pressed={opened} data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined} onClick={onToggle}>
    <Indicator inline size={7} withBorder color="var(--pi-danger)" disabled={!alerts.any}><IconActivity size={19} /></Indicator>
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </ActionIcon>;
}
