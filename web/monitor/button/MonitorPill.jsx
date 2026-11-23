import { alertsOf } from "../readings/alerts-of.js";
import { deltaLabel } from "../readings/delta-label.js";
import { machineFacts } from "../readings/machine-facts.js";
import { UnstyledButton } from "@mantine/core";
import "./monitor-button.css";
export function MonitorPill({ sessionRow, opened, onToggle }) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  const facts = machineFacts(sessionRow.monitor?.machine);
  return <UnstyledButton id="toggle-monitor" className="pi-monitor-pill" aria-label="监控" title="监控" aria-pressed={opened} data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined} onClick={onToggle}>
    {alerts.any ? <span className="pi-monitor-dot" aria-hidden="true" /> : null}
    {facts.length ? facts.map(([label, value]) => <span key={label} className="pi-monitor-pill-fact"><span>{label}</span><b>{value ?? "—"}</b>{value !== null ? "%" : ""}</span>) : <span className="pi-monitor-pill-fact"><span>监控</span></span>}
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </UnstyledButton>;
}
