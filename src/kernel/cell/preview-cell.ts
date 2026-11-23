import type { KernelContext } from "../kernel-state.ts";
import type { KernelCellPreview } from "../kernel-types.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../config/terminal/terminal-options.ts";
import { compactCellOutput } from "../output/format-running-cell.ts";
import { measureCell } from "./measure-cell.ts";
import { stoppingSnapshot } from "./stopping-snapshot.ts";

export function previewCell(ctx: KernelContext, id: string, includeStopped = false, now?: number): KernelCellPreview | undefined {
  const cell = ctx.cells.get(id) ?? ctx.pendingFinished.get(id);
  if (!cell?.kernelId || !cell.toolCallId || (cell.userStopped && !includeStopped)) return undefined;
  const { elapsedMs, activeMs } = measureCell(cell, now ?? ctx.clock.now());
  const stopping = stoppingSnapshot(ctx, cell);
  const status = cell.outcome !== undefined ? "freezing" : stopping || cell.runnerState?.state === "stopping" ? "stopping" : "running";
  const { blockedAt, observedAt } = cell.runnerState ?? {};
  const { output, truncated } = compactCellOutput(cell, ctx.hooks.outputOptions ?? DEFAULT_TERMINAL_OPTIONS);
  return { cellId: id, kernelId: cell.kernelId, toolCallId: cell.toolCallId, startedAt: cell.startedAt, language: ctx.snapshot.language, output, truncated,
    imageCount: cell.images.length + cell.omittedImages, elapsedMs, activeMs, status,
    ...(status === "running" && cell.timeoutMs ? { deadlineRemainingMs: Math.max(0, cell.timeoutMs - activeMs) } : {}),
    ...(cell.mode === undefined ? {} : { mode: cell.mode }),
    ...(blockedAt === undefined ? {} : { blockedAt }),
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(stopping === undefined ? {} : { stopping }),
    ...(cell.taskName === undefined ? {} : { taskName: cell.taskName }),
    waitingForAsk: !cell.callbacks.signal.aborted && cell.pendingCallback?.name === "ask" };
}
