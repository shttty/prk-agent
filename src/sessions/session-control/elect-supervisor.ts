import type { SupervisorCandidate } from "./control-types.ts";

export function electSupervisor(candidates: readonly SupervisorCandidate[], current?: string): string | null {
  let earliest: SupervisorCandidate | undefined;
  for (const candidate of candidates) {
    if (candidate.sessionId === current) return current;
    if (!earliest || candidate.createdAt < earliest.createdAt
      || (candidate.createdAt === earliest.createdAt && candidate.sessionId < earliest.sessionId)) earliest = candidate;
  }
  return earliest?.sessionId ?? null;
}
