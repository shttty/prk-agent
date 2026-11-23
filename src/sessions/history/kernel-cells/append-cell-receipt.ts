import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { KernelActiveCell, KernelFinishedCell } from "../../../kernel/kernel-types.ts";
import { CELL_OPEN, CELL_RESULT, type KernelCellReceipt } from "./delivery-types.ts";
import { readCellEntries } from "./read-cell-entries.ts";
import { retainUnsavedCell } from "./retain-unsaved-cell.ts";

export function appendCellOpen(manager: SessionManager, cell: KernelActiveCell): void {
  manager.appendCustomEntry(CELL_OPEN, { ...cell, version: 1, sessionId: manager.getSessionId() });
}

export function appendCellReceipt(manager: SessionManager, cell: KernelFinishedCell): string | undefined {
  const entries = readCellEntries(manager, cell.cellId).get(cell.cellId);
  if (!entries || entries.result || entries.open.kernelId !== cell.kernelId || entries.open.toolCallId !== cell.toolCallId
    || entries.open.startedAt !== cell.startedAt) return;
  const receipt: KernelCellReceipt = { ...entries.open, result: cell.result, outcome: cell.result.details.outcome,
    finishedAt: cell.finishedAt, reason: cell.result.details.reason ?? (cell.userStopped() ? "Stopped by the user." : cell.reason) };
  try {
    return manager.appendCustomEntry(CELL_RESULT, receipt);
  } catch (error) {
    retainUnsavedCell(manager, receipt);
    throw error;
  }
}
