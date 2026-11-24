export type OperationKind = "compact";
export type OperationCompletionStatus = "completed" | "failed" | "cancelled" | "unknown";

export interface OperationCompletion {
  readonly operationId: string;
  readonly kind?: OperationKind;
  readonly status: OperationCompletionStatus;
  readonly requestIds: readonly string[];
  readonly error?: string;
  readonly returnedMessages?: readonly string[];
}

export type OperationCompletionObserver = (completion: OperationCompletion, interruption: { reason?: string; initiatorSessionId?: string }) => void;

export interface HostOperationSnapshot {
  readonly operationId: string;
  readonly kind?: OperationKind;
  /** Start of this admitted run, epoch milliseconds; queued inputs share it. */
  readonly startedAt: number;
  readonly state: "accepted" | "running" | "cancel_requested";
  readonly requestIds: readonly string[];
}

export type Operation = {
  id: string;
  kind?: OperationKind;
  startedAt: number;
  messageCount: number;
  requestIds: Set<string>;
  completion: PromiseWithResolvers<OperationCompletion>;
  pending: number;
  cancelled: boolean;
  userCancelled?: boolean;
  preservePeerInbox?: boolean;
  aborting?: Promise<void>;
  error?: string;
  aborted: boolean;
  pythonStarted: boolean;
  unknown: boolean;
  cancelReason?: string;
  cancelInitiatorSessionId?: string;
  returnedMessages: string[];
};
