import type { SessionLifecycleEvent } from "../../sessions/collection/collection-types.ts";

export interface TargetEnvironmentSnapshot {
  target: string;
  streamId: string;
  revision: number;
  status: "idle" | "checking" | "transferring" | "ready" | "failed";
  transferredBytes: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}
export interface EnvironmentRecord {
  snapshot: TargetEnvironmentSnapshot;
  pending?: Promise<void>;
  abort: AbortController;
}
export interface TargetEnvironmentEvent {
  type: "target_environment_changed";
  target: string;
  timestamp: string;
  details: { environment: TargetEnvironmentSnapshot };
  sessionId?: never;
}
export type GatewayCollectionEvent = SessionLifecycleEvent | TargetEnvironmentEvent;
