import { alertsOf } from "../readings/alerts-of.js";
import { deltaLabel } from "../readings/delta-label.js";
import { ActionIcon } from "@mantine/core";
import { IconActivity } from "@tabler/icons-react";
import "./monitor-button.css";
export default function MonitorButton({ sessionRow, opened, onToggle }) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  return <ActionIcon id="toggle-monitor" className="pi-monitor-toggle" variant={opened ? "light" : "subtle"} color="gray" size="lg" aria-label="监控" title="监控" aria-pressed={opened} data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined} onClick={onToggle}>
    <span className="pi-monitor-glyph"><IconActivity size={19} />{alerts.any ? <span className="pi-monitor-dot" aria-hidden="true" /> : null}</span>
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </ActionIcon>;
}
