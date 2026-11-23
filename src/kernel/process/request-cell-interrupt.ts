import type { KernelContext } from "../kernel-state.ts";
import type { KernelInterruptReceipt, KernelRestartPolicy, KernelToolResult } from "../kernel-types.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { ownsFrames } from "../cell/owns-frames.ts";
import { stoppingSnapshot } from "../cell/stopping-snapshot.ts";
import { interrupt } from "./interrupt.ts";
import { stop } from "./stop.ts";

export async function requestCellInterrupt(ctx: KernelContext, cellId: string, restart?: KernelRestartPolicy): Promise<KernelToolResult | KernelInterruptReceipt> {
  const cell = ctx.cells.get(cellId);
  const process = ctx.process;
  const notFound = () => new WireError("NOT_FOUND", `No interruptible cell ${cellId} in this session.`);
  if (ctx.closed || !process) throw notFound();
  if (restart === "now" && process.retirementReceipt?.affectedCells.some((affected) => affected.cellId === cellId)) {
    return { ...((await process.stopping)!), status: "retired", cell_id: cellId, restart };
  }
  if (!cell?.yielded || !ownsFrames(ctx, process, cell)) throw notFound();
  if (restart === "now") {
    const receipt = await stop(ctx, process, { cause: "interrupt-now", initiatorCellId: cellId });
    return { ...receipt!, status: "retired", cell_id: cellId, restart };
  }

  const repeatedNever = cell.interruption?.restart === "never";
  void interrupt(ctx, cell, "Interrupted by the model.", restart).catch(() => {});
  const interruption = cell.interruption!;
  const graceMs = Math.max(0, Math.ceil(interruption.deadline - ctx.clock.now()));
  const snapshot = stoppingSnapshot(ctx, cell)!;
  if (snapshot.cleanup === "unconfirmed") return snapshot;
  if (interruption.restart === "auto") {
    return { status: "requested", cell_id: cellId, restart: "auto", grace_ms: graceMs, peers: snapshot.peers };
  }
  if (repeatedNever || graceMs === 0) return snapshot;
  const settled = await Promise.race([cell.result!, interruption.expired]);
  if (settled) return settled;
  if (process.retired || cell.outcome !== undefined) return cell.result!;
  return stoppingSnapshot(ctx, cell)!;
}
