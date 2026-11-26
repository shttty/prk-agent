import type { RestoredQueueCount } from "../../session-storage/session-storage-types.ts";
import type { OperationEntry } from "../store-types.ts";

/** Operations a reload remembers only for how many of their returned inputs were already put back. */
export function restoredOperations(counts: readonly RestoredQueueCount[]): Map<string, OperationEntry> {
  return new Map(counts.map(([operationId, restoredQueueCount]) => [operationId, { restoredQueueCount }]));
}
