import type { KernelCellResult } from "../../../kernel/kernel-types.ts";
import type { KernelCellDelivery } from "../../../sessions/history/kernel-cells/delivery-types.ts";

export type KernelResultView = KernelCellDelivery & {
  readonly sessionId: string;
  readonly result?: KernelCellResult;
};
