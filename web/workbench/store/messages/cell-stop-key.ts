import type { SessionPendingKey } from "../store-types.ts";

/** Pending key of a directed (`cellOnly`) stop: one per cell identity, so stopping one row never blocks its peers. */
export function cellStopKey(cell: { kernelId: string; cellId: string }): SessionPendingKey {
  return `stopping:${cell.kernelId}:${cell.cellId}`;
}
