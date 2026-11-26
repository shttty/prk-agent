
export function toolDurationMs(timing: { startedAt?: unknown; completedAt?: unknown } | undefined): number | null {
  const start = Number(timing?.startedAt);
  const end = Number(timing?.completedAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
}
