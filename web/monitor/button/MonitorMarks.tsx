import { Flex } from "@mantine/core";
import { alertsOf } from "../readings/alerts-of.ts";
import { deltaLabel } from "../readings/delta-label.ts";
import type { MonitoredRow } from "../readings/monitor-types.ts";
import "./monitor-button.css";

/** Session-row marks, low-key and never wider than a few characters: the alert dot and the change count. */
export function MonitorMarks({ sessionRow }: { sessionRow: MonitoredRow }) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  if (!alerts.any && !delta) return null;
  const reason = alerts.kernel ? "kernel 已退出" : alerts.oom ? "kernel 发生过 OOM" : "内存接近上限";
  return <Flex component="span" align="center" gap={4} className="pi-monitor-marks" data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined}>
    {alerts.any ? <span className="pi-monitor-dot" role="img" aria-label={reason} /> : null}
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </Flex>;
}
