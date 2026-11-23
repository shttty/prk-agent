import LineChart from "./LineChart.jsx";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
export function Metric({ id, title, value, unit, detail, points, window, max, alert, wide, name, error }) {
  return <div className={`pi-monitor-metric${wide ? " is-wide" : ""}`} id={id} data-metric={name} data-status={name ? error ? "error" : value === null ? "pending" : "ok" : undefined} data-alert={alert ? "true" : undefined} data-points={points?.length ?? 0} data-first-at={points?.[0]?.[0]}>
    <div className="pi-monitor-metric-head"><span className="pi-monitor-metric-title">{title}</span><span className="pi-monitor-metric-detail">{detail}</span></div>
    <div className="pi-monitor-metric-value">{value ?? "—"}{value !== null && unit ? <small>{unit}</small> : null}</div>
    {points ? <LineChart points={points} from={window[0]} to={window[1]} max={max} /> : null}
    {error ? <InlineAlert className="pi-monitor-error">{error}</InlineAlert> : null}
  </div>;
}
