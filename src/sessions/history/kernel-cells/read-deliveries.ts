import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { KernelActiveCell } from "../../../kernel/kernel-types.ts";
import type { KernelCellDelivery, KernelCellOpen, KernelCellReceipt, KernelCellCheckpoint } from "./delivery-types.ts";
import { readCellEntries } from "./read-cell-entries.ts";
import { readUnsavedCell } from "./retain-unsaved-cell.ts";

export function listCellDeliveries(manager: SessionManager, activeCells: readonly KernelActiveCell[] = []): readonly KernelCellDelivery[] {
  const deliveries: KernelCellDelivery[] = [];
  for (const cell of readCellEntries(manager).values()) {
    deliveries.push(summarize(manager, cell.open, cell.result, cell.delivered, activeCells, cell.lastCheckpoint));
  }
  return deliveries;
}

export function readCellDelivery(manager: SessionManager, id: string, activeCells: readonly KernelActiveCell[] = []): KernelCellDelivery | undefined {
  const cell = readCellEntries(manager, id).get(id);
  if (cell) return summarize(manager, cell.open, cell.result, cell.delivered, activeCells, cell.lastCheckpoint);
}

function summarize(manager: SessionManager, open: KernelCellOpen, saved: KernelCellReceipt | undefined, delivered: boolean | undefined,
  activeCells: readonly KernelActiveCell[], lastCheckpoint?: KernelCellCheckpoint): KernelCellDelivery {
  const { cellId, kernelId, toolCallId, startedAt } = open;
  const identity = { cellId, kernelId, toolCallId, startedAt, ...(open.language === undefined ? {} : { language: open.language }), ...(lastCheckpoint ? { lastCheckpoint } : {}) };
  const result = saved ?? readUnsavedCell(manager, cellId);
  if (result) return { ...identity, finishedAt: result.finishedAt, outcome: result.outcome, truncated: result.result.details.truncated,
    ...(result.result.details.cause !== undefined && { cause: result.result.details.cause, initiatorCellId: result.result.details.initiatorCellId,
      affectedCells: result.result.details.affectedCells }),
    ...(result.reason === undefined ? {} : { reason: result.reason }),
    imageCount: result.result.content.filter(({ type }) => type === "image").length,
    delivery: !saved ? "unsaved" : delivered ? "delivered" : "unconfirmed",
    ...(!saved ? { notice: "结果写入会话失败" } : !delivered ? { notice: "结果已保存，通知未确认" } : {}) };
  if (activeCells.some((cell) => cell.cellId === cellId && cell.kernelId === kernelId && cell.toolCallId === toolCallId)) {
    return { ...identity, delivery: "running", imageCount: 0 };
  }
  return { ...identity, delivery: "unknown", outcome: "unknown", imageCount: 0, notice: "执行结果未知（Gateway 中断）" };
}
