import type { KernelCellIdentity } from "../../../kernel/kernel-types.ts";
import type { OperationCompletion } from "../host-types.ts";

export interface KernelInterruptRequest extends KernelCellIdentity {
  readonly cellOnly?: boolean;
}

export interface CancelRequest {
  readonly operationId: string;
  readonly cell?: KernelCellIdentity;
}

export interface CancelResult {
  readonly operationId: string;
  readonly status: "requested" | "already_complete" | "not_found";
  readonly completion?: Promise<OperationCompletion>;
  readonly returnedMessages: readonly string[];
}

export interface KernelInterruptResult extends KernelCellIdentity {
  readonly status: "requested" | "not_found";
  readonly returnedMessages: readonly string[];
}
