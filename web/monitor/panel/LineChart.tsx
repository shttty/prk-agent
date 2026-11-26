import { useId } from "react";
import type { ChartPoints } from "../readings/monitor-types.ts";

const W = 100;
const H = 32;

type LineChartProps = { points: ChartPoints; from: number; to: number; max?: number };

/** One metric's line over the window; the SVG stretches to its box (viewBox units, not pixels). */
export default function LineChart({ points, from, to, max }: LineChartProps) {
  const gradient = `pi-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bottom = max === undefined ? Math.min(0, ...points.map(([, value]) => value)) : 0;
  const top = max ?? Math.max(0, ...points.map(([, value]) => value)) * 1.2;
  const span = top - bottom || 1;
  const x = (t: number) => Math.max(0, Math.min(W, ((t - from) / (to - from)) * W));
  const y = (value: number) => H - 1 - ((Math.max(bottom, Math.min(value, top)) - bottom) / span) * (H - 2);
  const line = points.map(([t, value], index) => `${index ? "L" : "M"}${x(t).toFixed(2)},${y(value).toFixed(2)}`).join("");
  const first = points[0]?.[0] ?? from;
  const last = points.at(-1)?.[0] ?? to;
  return <svg className="pi-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity=".26" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
    <line className="pi-chart-grid" x1="0" x2={W} y1={H / 2} y2={H / 2} vectorEffect="non-scaling-stroke" />
    <path d={`${line}L${x(last).toFixed(2)},${H}L${x(first).toFixed(2)},${H}Z`} fill={`url(#${gradient})`} />
    <path className="pi-chart-line" d={line} vectorEffect="non-scaling-stroke" />
  </svg>;
}
