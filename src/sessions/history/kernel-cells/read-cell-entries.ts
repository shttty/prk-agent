import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { CELL_FINISHED_SUFFIX, CELL_OPEN, CELL_RESULT, type KernelCellOpen, type KernelCellReceipt, type KernelCellCheckpoint } from "./delivery-types.ts";

interface CellEntries {
  open: KernelCellOpen;
  openEntryId: string;
  result?: KernelCellReceipt;
  delivered?: true;
  lastCheckpoint?: KernelCellCheckpoint;
}

export function readCellEntries(manager: SessionManager, filter?: string): Map<string, CellEntries> {
  const sessionId = manager.getSessionId();
  const cells = new Map<string, CellEntries>();
  for (const entry of manager.getBranch()) {
    if (entry.type === "custom" && entry.customType === CELL_OPEN) {
      const open = entry.data as KernelCellOpen | undefined;
      if (!open || open.version !== 1 || open.sessionId !== sessionId || typeof open.cellId !== "string" || typeof open.kernelId !== "string"
        || typeof open.toolCallId !== "string" || !Number.isFinite(open.startedAt) || (filter !== undefined && open.cellId !== filter)) continue;
      if (!cells.has(open.cellId)) cells.set(open.cellId, { open, openEntryId: entry.id });
    } else if (entry.type === "custom" && entry.customType === CELL_RESULT) {
      const result = entry.data as KernelCellReceipt | undefined;
      if (!result || result.version !== 1 || result.sessionId !== sessionId) continue;
      const cell = cells.get(result.cellId);
      if (cell && !cell.result && result.kernelId === cell.open.kernelId && result.toolCallId === cell.open.toolCallId && Array.isArray(result.result?.content)) cell.result = result;
    } else if (entry.type === "custom_message" && entry.customType === "kernel-event") {
      const details = entry.details as (KernelCellCheckpoint & { kind?: string }) | undefined;
      if (!details || details.sessionId !== sessionId || typeof details.cellId !== "string") continue;
      const cell = cells.get(details.cellId);
      if (!cell || details.kernelId !== cell.open.kernelId || details.toolCallId !== cell.open.toolCallId) continue;
      if (details.kind === "finished" && cell.result && details.eventId === `${details.cellId}${CELL_FINISHED_SUFFIX}`) cell.delivered = true;
      if (details.kind === "checkpoint" && Number.isSafeInteger(details.step) && details.step > 0
        && details.eventId === `${details.cellId}:checkpoint:${details.step}` && Number.isFinite(details.elapsedMs)
        && Number.isFinite(details.activeMs) && Number.isFinite(details.nextInMs)) {
        cell.lastCheckpoint = { sessionId, kernelId: cell.open.kernelId, cellId: cell.open.cellId, toolCallId: cell.open.toolCallId,
          startedAt: cell.open.startedAt, eventId: details.eventId, step: details.step,
          elapsedMs: details.elapsedMs, activeMs: details.activeMs, nextInMs: details.nextInMs };
      }
    }
  }
  return cells;
}
