
export function toolDurationMs(timing) {
  const start = Number(timing?.startedAt);
  const end = Number(timing?.completedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
}
