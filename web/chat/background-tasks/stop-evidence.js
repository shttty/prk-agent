/**
 * Where a stopping cell is held, from the snapshot's `blockedAt` steps (the stopping projection adds the isolated
 * step in front). `latest` is the most recent step; `timerMs` is the bounded timer wait's remaining upper bound as
 * observed on the target. Wall clocks differ between target and browser, so the bound is shown as reported.
 */
export function stopEvidence(cell) {
  const steps = cell.stopping?.blockedAt ?? cell.blockedAt ?? [];
  if (cell.status !== "stopping" || !steps.length) return null;
  const timer = steps.findLast((step) => step.step === "timer" && step.status === "bounded" && Number.isFinite(step.remainingMs));
  return { latest: steps.at(-1), steps, timerMs: timer?.remainingMs };
}
