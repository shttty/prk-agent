import type { MonitoredProcess, ProcessRoot } from "../telemetry/process-types.ts";
import type { MonitorOptions } from "../../config/monitor/monitor-options.ts";
import type { CustomMetric } from "../../config/custom-metrics/custom-metrics-options.ts";
import type { KernelSnapshot } from "../../kernel/kernel-types.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { TargetChannels } from "../../target-channel/channels/channel-types.ts";
import type { ChangedFile, DirSample, MachineSample, RemoteHostMonitor } from "../telemetry/telemetry-types.ts";
import type { SampleHistory } from "../sample-history/assemble-sample-history.ts";
import type { MonitorHistory } from "../sample-history/sample-history-types.ts";
import type { CustomMetricStore } from "../custom-metrics/assemble-custom-metrics.ts";
import type { MetricView } from "../custom-metrics/custom-metrics-types.ts";

export interface MonitoredSession {
  readonly sessionId: string;
  readonly machine: string;
  /** The session directory whose uncommitted changes are watched. */
  readonly cwd?: string;
}

export interface AgentChanges {
  readonly added: number;
  readonly removed: number;
  readonly files: readonly ChangedFile[];
}

export interface MonitorDeps {
  readonly options: MonitorOptions;
  readonly channels: TargetChannels;
  readonly processRoots: (sessionId: string) => readonly ProcessRoot[];
  readonly onDetachedChanged: (sessionId: string, detached: boolean) => void;
  readonly customMetrics?: (instance: string) => readonly CustomMetric[];
  /** The "agent write/edit" changes of a session whose cwd has no git, derived from its SDK history. */
  agentChanges(sessionId: string): AgentChanges;
  /** Pi-format diff text of one agent-changed file. */
  agentDiff(sessionId: string, path: string): string;
  readonly log?: (message: string) => void;
  readonly now?: () => number;
}

export interface SessionChanges extends AgentChanges {
  readonly source: "git" | "agent";
  readonly truncated: boolean;
  readonly error?: string;
  /** Agent source only: why git gave no repository (first stderr line), and whether git was unable to decide (vs. plainly no repository). */
  readonly gitReason?: string;
  readonly gitUnavailable?: boolean;
  readonly ageMs: number;
}

export interface SessionMonitor {
  /** The machine's collector: starting, ok, error (retries exhausted), or stopped (no awake session). */
  readonly state: "starting" | "ok" | "error" | "stopped";
  readonly error?: string;
  readonly intervalMs?: number;
  readonly alerts: { readonly kernel: boolean; readonly oom: boolean; readonly memory: boolean };
  readonly machine?: MachineSample & { readonly ageMs: number; readonly sampledAt: number };
  readonly customMetrics: readonly MetricView[];
  readonly processes: readonly MonitoredProcess[];
  readonly processesTruncated: boolean;
  readonly changes?: SessionChanges;
  /** One target Node scope; null when this session has no remote extension/native host. */
  readonly remoteHost: RemoteHostMonitor | null;
}

export type FileDiff = { readonly kind: "git"; readonly text: string; readonly truncated: boolean } | { readonly kind: "agent"; readonly text: string };

export interface Stamped<T> { readonly at: number; readonly value: T }

export interface SessionRecord {
  machine: string | undefined;
  historyMachine: string | undefined;
  cwd: string | undefined;
  alerts: SessionMonitor["alerts"];
  sample: Stamped<MachineSample> | undefined;
  dir: Stamped<DirSample> | undefined;
  agent: Stamped<AgentChanges> | undefined;
  refreshTimer: ReturnType<typeof setTimeout> | undefined;
  remoteHost: RemoteHostMonitor | null;
  processes: readonly MonitoredProcess[];
  processesTruncated: boolean;
}

export interface MachineRecord {
  readonly id: string;
  state: SessionMonitor["state"];
  error: string | undefined;
  lease: TargetLease | undefined;
  unsubscribe: (() => void) | undefined;
  intervalMs: number | undefined;
  watched: string;
  readonly history: SampleHistory<MachineSample>;
  readonly custom: CustomMetricStore;
}

/** Gateway-side owner of every machine's collector and of the per-session numbers derived from it. */
export interface MonitorService {
  /** Last known monitor of a session, kept after it sleeps; undefined for sessions never seen. */
  get(sessionId: string): SessionMonitor | undefined;
  history(instance: string): MonitorHistory;
  /** The full set of awake sessions; machines with none are stopped, new ones started. */
  setSessions(desired: readonly MonitoredSession[]): void;
  /** Card open (true, a lease: repeat to keep it) or closed: fast or slow collection for the session's machine. */
  focus(sessionId: string, open: boolean): void;
  /** A tool finished in the session: re-read its changes soon. */
  refresh(sessionId: string): void;
  /** Kernel health from the existing kernel snapshot; undefined when the session has no kernel runtime. */
  reportKernel(sessionId: string, kernel: KernelSnapshot | undefined): void;
  reportRemoteHost(sessionId: string, host: RemoteHostMonitor | null): void;
  diff(sessionId: string, path: string): Promise<FileDiff>;
  subscribe(listener: (sessionId: string, monitor: SessionMonitor) => void): () => void;
  close(): Promise<void>;
}
