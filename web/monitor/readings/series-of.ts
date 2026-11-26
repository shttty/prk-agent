import type { ChartPoints, MachinePoint } from "./monitor-types.ts";

export function seriesOf(history: readonly MachinePoint[], pick: (point: MachinePoint) => number | null | undefined): ChartPoints | null {
  const pairs: ChartPoints = [];
  for (const point of history) {
    const value = pick(point);
    if (typeof value === "number" && Number.isFinite(value)) pairs.push([point.t, value]);
  }
  return pairs.length > 1 ? pairs : null;
}
