
export function seriesOf(history, pick) {
  const pairs = history.map((point) => [point.t, pick(point)]).filter(([, value]) => Number.isFinite(value));
  return pairs.length > 1 ? pairs : null;
}
