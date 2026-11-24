import type { ConfigurationIssue } from "../../config/execution-target/configuration-issue.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { KernelSnapshot } from "../../kernel/kernel-types.ts";
import type { SessionRuntime } from "../runtime/runtime-types.ts";
import type { SessionRuntimeDependencies } from "../runtime/runtime-types.ts";
import type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";
import type { TaskTiming } from "../derivation/read-task-timing.ts";
import type { SessionMonitor } from "../../monitor/session-monitor/session-monitor-types.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { createSessionRuntime } from "../runtime/assemble-runtime.ts";

export type SessionState = "idle" | "starting" | "running" | "sleeping" | "unavailable" | "closing" | "closed";

export interface SessionRecovery {
  readonly status: "available" | "unavailable" | "new";
  readonly message: string;
  readonly code?: "TARGET_UNREACHABLE";
}

export interface ManagedSessionSnapshot extends TaskTiming {
  readonly target: string;
  readonly label: string;
  /** Effective Python cwd captured for this session. */
  readonly cwd: string;
  readonly configurationIssue?: ConfigurationIssue;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly projectCreated?: string;
  readonly sessionId: string;
  readonly history?: boolean;
  readonly state: SessionState;
  readonly requiresReload?: boolean;
  readonly compacting?: true;
  readonly kernel?: KernelSnapshot;
  readonly recovery?: SessionRecovery;
  readonly derivation?: DerivedSessionInfo;
  /** Gateway-owned machine/change/alert numbers; attached by the Gateway host, never by the collection. */
  readonly monitor?: SessionMonitor;
  /** An `ask` card waits for the user in this session's live runtime; attached by the Gateway host. */
  readonly asking?: true;
}

export interface SessionLifecycleEvent {
  readonly type: string;
  readonly sessionId: string;
  readonly timestamp: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type SessionLifecycleListener = (event: SessionLifecycleEvent) => void;

export interface SessionCollectionOptions {
  readonly getRuntimeDependencies?: () => SessionRuntimeDependencies | Promise<SessionRuntimeDependencies>;
  readonly runtimeDependencies?: SessionRuntimeDependencies;
  readonly sessionFactory?: typeof createSessionRuntime;
  readonly configureRuntimeDependencies?: (sessionId: string, dependencies: SessionRuntimeDependencies, manager: SessionManager) => SessionRuntimeDependencies | Promise<SessionRuntimeDependencies>;
  readonly limits?: LimitsOptions;
}

export interface SessionCreateOptions {
  /** Effective Python cwd for this session (absolute); omitted uses the target's. */
  readonly cwd?: string;
  readonly mode?: "new" | "wake";
}

export interface SessionCollection {
  list(): readonly ManagedSessionSnapshot[];
  get(sessionId: string): SessionRuntime | undefined;
  /** Reuse a retained identity, or create an independent identity on the configured target. */
  create(target: string, sessionManager: SessionManager, options: SessionCreateOptions): Promise<SessionRuntime>;
  /** Dispose one runtime while retaining its durable SDK identity for explicit recovery. */
  reset(sessionId: string): Promise<void>;
  /** Rebuild idle SDK resources without replacing the identity, history manager, or Python kernel. */
  reload(sessionId: string): Promise<void>;
  close(): Promise<void>;
  snapshot(): readonly ManagedSessionSnapshot[];
  /** Validate an atomic target replacement without mutating live state. */
  previewTargets(targets: readonly ExecutionTarget[]): void;
  /** Atomically replace configured targets; active session bindings reject changes. */
  replaceTargets(targets: readonly ExecutionTarget[]): void;
  subscribe(listener: SessionLifecycleListener): () => void;
  closeSession(sessionId: string): Promise<void>;
  /** Drop a closed binding so a user-forced recovery can change target or cwd. */
  forget(sessionId: string): void;
}

export type SessionRecord = {
  target: ExecutionTarget;
  cwd: string;
  state: SessionState;
  readonly sessionId: string;
  readonly sessionManager: SessionManager;
  session?: SessionRuntime;
  pending?: Promise<SessionRuntime>;
  closing?: Promise<void>;
  requiresRecovery?: boolean;
  unsubscribeKernel?: () => void;
  unsubscribeHost?: () => void;
  tombstoned: boolean;
  closeEventEmitted: boolean;
};
