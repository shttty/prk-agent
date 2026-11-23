/** Pending key of a directed (`cellOnly`) stop: one per cell identity, so stopping one row never blocks its peers. */
export function cellStopKey(cell) {
  return `stopping:${cell.kernelId}:${cell.cellId}`;
}
