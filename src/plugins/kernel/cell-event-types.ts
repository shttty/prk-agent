import type { KernelActiveCell, KernelRetirementDetails, PythonOutcome, PythonToolDetails } from "../../kernel/kernel-types.ts";

export interface KernelFinishedEventDetails extends KernelActiveCell, Partial<Omit<KernelRetirementDetails, "reason">> {
  readonly eventId: string;
  readonly kind: "finished";
  readonly status: "finished";
  readonly sessionId: string;
  readonly elapsedMs: number;
  readonly activeMs: number;
  readonly finishedAt: number;
  readonly imageCount: number;
  readonly truncated: boolean;
  readonly outcome: PythonOutcome;
  readonly reason?: string;
  readonly suggestedMode?: PythonToolDetails["suggestedMode"];
  readonly lateCallbacks: readonly { name: string; status: string }[];
  readonly callbacksTruncated: boolean;
}
