import { alertsOf } from "../readings/alerts-of.js";
import { deltaLabel } from "../readings/delta-label.js";
import "./monitor-button.css";
export function MonitorMarks({ sessionRow }) {
  const alerts = alertsOf(sessionRow);
  const delta = deltaLabel(sessionRow);
  if (!alerts.any && !delta) return null;
  const reason = alerts.kernel ? "kernel 已退出" : alerts.oom ? "kernel 发生过 OOM" : "内存接近上限";
  return <span className="pi-monitor-marks" data-alert={alerts.any ? "true" : undefined} data-delta={delta ?? undefined}>
    {alerts.any ? <span className="pi-monitor-dot" role="img" aria-label={reason} /> : null}
    {delta ? <span className="pi-monitor-delta">{delta}</span> : null}
  </span>;
}
