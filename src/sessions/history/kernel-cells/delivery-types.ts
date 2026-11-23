import type { KernelActiveCell, KernelCellResult, KernelRetirementDetails, PythonOutcome } from "../../../kernel/kernel-types.ts";

export const CELL_OPEN = "kernel-cell-open";
export const CELL_RESULT = "kernel-cell-result";
export const CELL_FINISHED_SUFFIX = ":finished";

export interface KernelCellOpen extends KernelActiveCell {
  readonly version: 1;
  readonly sessionId: string;
}

export interface KernelCellReceipt extends KernelCellOpen {
  readonly outcome: PythonOutcome;
  readonly finishedAt: number;
  readonly reason?: string;
  readonly result: KernelCellResult;
}

export interface KernelCellCheckpoint extends KernelActiveCell {
  readonly sessionId: string;
  readonly eventId: string;
  readonly step: number;
  readonly elapsedMs: number;
  readonly activeMs: number;
  readonly nextInMs: number;
}

export interface KernelCellDelivery extends KernelActiveCell, Partial<Omit<KernelRetirementDetails, "reason">> {
  readonly delivery: "running" | "unknown" | "unconfirmed" | "delivered" | "unsaved";
  readonly imageCount: number;
  readonly outcome?: PythonOutcome;
  readonly finishedAt?: number;
  readonly truncated?: boolean;
  readonly reason?: string;
  readonly notice?: string;
  readonly lastCheckpoint?: KernelCellCheckpoint;
}
