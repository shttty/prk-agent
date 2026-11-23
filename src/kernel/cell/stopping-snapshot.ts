import type { KernelCell, KernelContext } from "../kernel-state.ts";
import type { KernelStoppingSnapshot } from "../kernel-types.ts";

export function stoppingSnapshot(ctx: KernelContext, cell: KernelCell): KernelStoppingSnapshot | undefined {
  if (cell.outcome !== undefined) return undefined;
  const receipt = ctx.process?.retirementReceipt;
  const retiring = receipt?.kernelId === cell.kernelId && receipt?.affectedCells.some(({ cellId }) => cellId === cell.id);
  const restart = retiring ? "now" : cell.interruption?.restart;
  if (!restart) return undefined;
  const stop = cell.isolatedStop;
  const evidence = stop && {
    step: "isolated", observedAt: stop.observedAt, status: stop.status,
    evidence: {
      pending: "Cancellation recorded before fork; waiting for runner settlement",
      reaped: "Forkserver confirmed group exit and reaping; waiting for owned output to drain",
      finished: "Forkserver accepted completion before cancellation; waiting for runner settlement",
      unconfirmed: "Forkserver cleanup could not be confirmed; use restart:'now' to retire the generation explicitly",
    }[stop.status],
  };
  const isolated = cell.mode === "isolated" || (cell.mode === undefined && cell.isolatedCandidate);
  const cleanup = !retiring && isolated && (stop?.status === "unconfirmed" || ctx.clock.now() >= cell.interruption!.deadline);
  return {
    status: "stopping", cell_id: cell.id, restart, ...(cleanup && { cleanup: "unconfirmed" }),
    blockedAt: evidence ? [evidence, ...(cell.runnerState?.blockedAt ?? [])] : cell.runnerState?.blockedAt ?? [],
    observedAt: evidence?.observedAt ?? cell.runnerState?.observedAt ?? null,
    peers: Array.from(ctx.cells.values()).filter((peer) => peer !== cell && peer.kernelId === cell.kernelId && peer.requestId !== undefined)
      .map((peer) => ({ cell_id: peer.id, title: peer.taskName!, state: peer.outcome !== undefined ? "freezing"
        : peer.interruption || peer.runnerState?.state === "stopping" || retiring ? "stopping" : "running" })),
  };
}
