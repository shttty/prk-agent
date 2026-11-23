import { Metric } from "./Metric.jsx";
export function CustomSection({ history, now }) {
  if (!history?.customMetrics.length) return null;
  const window = [now - history.windowMs, now];
  return <section className="pi-monitor-section" id="monitor-custom" aria-label="自定义">
    <h3>自定义</h3>
    <div className="pi-monitor-metrics">
      {history.customMetrics.map((metric) => {
        const samples = metric.samples.filter(({ at }) => at >= window[0]);
        const result = metric.samples.at(-1)?.value;
        const points = samples.filter(({ value }) => Number.isFinite(value.value)).map(({ at, value }) => [at, value.value]);
        return <Metric key={metric.name} name={metric.name} title={metric.name} value={result?.value ?? null} unit={metric.unit} error={result?.error} points={points.length > 1 ? points : null} window={window} />;
      })}
    </div>
  </section>;
}
