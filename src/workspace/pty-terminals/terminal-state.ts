import type { RemoteTerminal } from "@earendil-works/pi-env";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";
import type { WorkspaceOptions } from "../../config/workspace/workspace-options.ts";
import type { TerminalEvent, ModelTerminalStartup, ShellIntegrationStatus } from "../terminals/terminals-types.ts";
import type { TerminalReplay } from "../terminal-replay/create-replay.ts";
import type { PythonRuntime } from "../../target-environment/python/resolve-python-runtime.ts";

export interface PtyTerminalOptions {
  workspace: WorkspaceOptions;
  acquire(instanceId: string): Promise<TargetEnvironmentLease>;
  runtime(instanceId: string, environment: TargetEnvironmentLease): Promise<PythonRuntime>;
  ownerTarget(sessionId: string): string | undefined;
  onCleanupUnknown(error: unknown, sessionId: string, name: string): void;
}
export interface PtyEntry {
  sessionId: string;
  name: string;
  target: string;
  generation: string;
  startup?: ModelTerminalStartup;
  rows: number;
  cols: number;
  replay: TerminalReplay;
  listeners: Set<(event: TerminalEvent) => void>;
  integration: ShellIntegrationStatus;
  integrationReady: Promise<void>;
  finishIntegration(): void;
  markerTail: string;
  decoder: TextDecoder;
  closed: boolean;
  closing?: Promise<{ closed: true }>;
  shellPid?: number;
  daemonSession?: number;
  wrapperPid?: number;
  cleanup?: "linux-pdeathsig" | "normal-close-only";
  startupText: string;
  handshake: Promise<void>;
  resolveHandshake(): void;
  rejectHandshake(error: unknown): void;
  exited?: Promise<number>;
  release?: Promise<void>;
  opening?: Promise<void>;
  lease?: TargetEnvironmentLease;
  runtime?: PythonRuntime;
  terminal?: RemoteTerminal;
  stopAbort?: () => void;
}
export interface PtyContext {
  options: PtyTerminalOptions;
  sessions: Map<string, Map<string, PtyEntry>>;
  closingSessions: Map<string, Promise<void>>;
  stopped: boolean;
}
