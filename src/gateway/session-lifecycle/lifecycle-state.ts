import type { SessionRecovery } from "../../sessions/collection/collection-types.ts";

export interface LifecycleState {
  sessionIdleTimeoutMs: number;
  transitions: Map<string, Promise<void>>;
  recoveryStates: Map<string, SessionRecovery>;
  mutationInProgress: boolean;
  runtimeChanges: number;
  closing: Promise<void> | undefined;
  extensionLifetime: AbortController;
  idleTimer: ReturnType<typeof setInterval>;
}
