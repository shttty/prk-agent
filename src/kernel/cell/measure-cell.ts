import type { KernelCell } from "../kernel-state.ts";

export function measureCell(cell: KernelCell, now: number): { elapsedMs: number; activeMs: number } {
  const end = cell.endedAt ?? now;
  return {
    elapsedMs: Math.round(end - cell.submittedAt),
    activeMs: Math.round(cell.activeMs + (cell.activeSince === undefined ? 0 : end - cell.activeSince)),
  };
}
