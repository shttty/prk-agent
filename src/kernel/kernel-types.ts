import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { KernelCodeDetails, KernelMemory, KernelTelemetry, NamespaceSummary } from "../codemode/kernel-protocol/kernel-protocol-types.ts";
import type { KernelHelper } from "../codemode/module-catalog/catalog-types.ts";
import type { TerminalOptions } from "../config/terminal/terminal-options.ts";
import type { TargetEnvironmentLease } from "../target-environment/connection/connection-types.ts";
import type { ProcessWindowLimits } from "../target-environment/process-window/window-state.ts";
import type { bunParameters, pythonParameters } from "./declaration/kernel-tool-schema.ts";
import type { CellMode, KernelExecutionPolicy } from "./kernel-options.ts";
import type { RunnerCellState } from "./protocol/event-schema.ts";
import type { TargetLease } from "../target-channel/lease/lease-types.ts";
import type { BunPackages } from "./process/bun-package-root.ts";
import type { KernelFailure } from "./process/kernel-failure.ts";

export type PythonOutcome = "ok" | "error" | "aborted" | "unknown";
export interface KernelCellIdentity { readonly kernelId: string; readonly cellId: string }
export type KernelRetirementCause = "close" | "handoff" | "replace" | "reset" | "interrupt-now" | "interrupt-timeout";
export interface KernelRetirementDetails {
  readonly reason: "kernel 重启";
  readonly cause: KernelRetirementCause;
  readonly initiatorCellId?: string;
  readonly affectedCells: readonly (KernelCellIdentity & { readonly taskName: string })[];
}
export interface KernelRetirementRequest {
  readonly cause: KernelRetirementCause;
  readonly initiatorCellId?: string;
  readonly userStopped?: boolean;
}
export interface KernelRetirementReceipt extends KernelRetirementDetails { readonly kernelId: string }
export type KernelRestartPolicy = "auto" | "never" | "now";
export interface KernelStoppingSnapshot {
  readonly status: "stopping";
  readonly cell_id: string;
  readonly restart: KernelRestartPolicy;
  readonly cleanup?: "unconfirmed";
  readonly blockedAt: NonNullable<KernelCellPreview["blockedAt"]>;
  readonly observedAt: number | null;
  readonly peers: readonly KernelCellPeer[];
}
export interface KernelCellPeer {
  readonly cell_id: string;
  readonly title: string;
  readonly state: KernelCellPreview["status"];
}
export type KernelInterruptReceipt = KernelStoppingSnapshot
  | { readonly status: "requested"; readonly cell_id: string; readonly restart: "auto"; readonly grace_ms: number; readonly peers: readonly KernelCellPeer[] }
  | ({ readonly status: "retired"; readonly cell_id: string; readonly restart: "now" } & KernelRetirementReceipt);
export interface KernelActiveCell extends KernelCellIdentity { readonly toolCallId: string; readonly startedAt: number; readonly language?: KernelLanguage }
export interface KernelCellPreview extends KernelActiveCell {
  readonly output: string;
  readonly truncated: boolean;
  readonly imageCount: number;
  readonly elapsedMs: number;
  readonly activeMs: number;
  readonly taskName?: string;
  readonly waitingForAsk: boolean;
  readonly status: "running" | "stopping" | "freezing";
  readonly deadlineRemainingMs?: number;
  readonly mode?: CellMode;
  readonly blockedAt?: Readonly<NonNullable<RunnerCellState["blockedAt"]>>;
  readonly observedAt?: number;
  readonly stopping?: KernelStoppingSnapshot;
}
export type KernelInterruptSource = "user" | "notification";
export type KernelCallbackScope = <T>(signal: AbortSignal, action: () => Promise<T>) => Promise<T>;
export interface KernelExecutionOwner {
  readonly runCallback?: KernelCallbackScope;
  beforeYield(cell: KernelActiveCell): void;
}
export type KernelCellResult = AgentToolResult<PythonToolDetails> & { isError?: boolean };
export type KernelToolResult = AgentToolResult<PythonToolDetails | PythonRunningDetails> & { isError?: boolean };
export interface KernelFinishedCell extends KernelActiveCell, Partial<Omit<KernelRetirementDetails, "reason">> {
  readonly result: KernelCellResult;
  readonly finishedAt: number;
  readonly elapsedMs: number;
  readonly activeMs: number;
  readonly imageCount: number;
  readonly reason?: string;
  readonly lateCallbacks: readonly { name: string; status: string }[];
  readonly callbacksTruncated: boolean;
  userStopped(): boolean;
  release(): void;
}
export interface KernelDiagnostics {
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
}
export type KernelLanguage = "python" | "bun";
export interface KernelLanguageChange {
  readonly status: "changed" | "unchanged";
  readonly language: KernelLanguage;
  readonly variablesLost: boolean;
}

export interface KernelSnapshot {
  readonly state: "not_started" | "starting" | "idle" | "busy" | "unavailable" | "closing" | "closed" | "failed";
  readonly kernelId?: string;
  readonly connectionStatus?: "connected" | "connecting" | "disconnected";
  readonly lastOutcome?: PythonOutcome;
  readonly memory?: KernelMemory;
  readonly namespace?: NamespaceSummary;
  readonly diagnostics?: KernelDiagnostics;
  readonly language: KernelLanguage;
  readonly activeCells: readonly KernelCellPreview[];
}
export interface PythonToolDetails extends Partial<KernelCodeDetails>, Partial<KernelRetirementDetails> {
  target: string;
  outcome: PythonOutcome;
  interrupted?: true;
  truncated: boolean;
  rawOutput?: string;
  kernelId?: string;
  language?: KernelLanguage;
  mode?: CellMode;
  suggestedMode?: "isolated";
  reset?: KernelRetirementReceipt;
}
export interface PythonRunningDetails {
  readonly toolCallId: string;
  readonly kernelId: string;
  readonly startedAt: number;
  readonly language: KernelLanguage;
  readonly outcome?: never;
  readonly stopping?: KernelStoppingSnapshot;
  readonly reset?: KernelRetirementReceipt;
}
export interface KernelReminder {
  readonly cellId: string;
  readonly kernelId: string;
  readonly step: number;
  readonly dueMs: number;
  readonly activeMs: number;
  readonly nextInMs: number;
}
export interface KernelClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
}
export interface PythonToolClient {
  readonly tool: ToolDefinition<typeof pythonParameters | typeof bunParameters, PythonToolDetails | PythonRunningDetails>;
  readonly executeForeground: PythonToolClient["tool"]["execute"];
  executeOwned(owner: KernelExecutionOwner, ...args: Parameters<PythonToolClient["tool"]["execute"]>): Promise<KernelToolResult>;
  asyncExecution(): boolean;
  previewCell(cellId: string): KernelCellPreview | undefined;
  readCell(cellId: string, yieldSeconds?: number, imageIndex?: number, signal?: AbortSignal): Promise<KernelToolResult | undefined>;
  interruptCell(kernelId: string, cellId: string, reason: KernelInterruptSource): boolean;
  requestCellInterrupt(cellId: string, restart?: KernelRestartPolicy): Promise<KernelToolResult | KernelInterruptReceipt>;
  subscribeFinished(listener: (cell: KernelFinishedCell) => void): () => void;
  prepareHandoff(): Promise<void>;
  resumeAfterHandoff(): void;
  handoffInProgress(): boolean;
  hasInFlightCell(): boolean;
  close(): Promise<void>;
  setLanguage(language: KernelLanguage, prepare: () => Promise<KernelConfiguration["bun"]>, persist: () => void): Promise<KernelLanguageChange>;
  ensure(): Promise<void>;
  clear(): Promise<KernelSnapshot>;
  refreshCapabilities(): Promise<void>;
  isFileCallback(name: string): boolean;
  restart(): Promise<KernelSnapshot>;
  getSnapshot(): KernelSnapshot;
  processRoot(): { pid: number; infrastructurePid?: number } | undefined;
  variables(): { variables: NamespaceSummary["variables"]; truncated: boolean };
  deleteVariable(name: string): Promise<KernelSnapshot>;
  afterCompaction(): void;
  subscribe(listener: (snapshot: KernelSnapshot) => void): () => void;
  subscribeReminders(listener: (reminder: KernelReminder) => void): () => void;
}
export type KernelObservationSource = Pick<PythonToolClient, "getSnapshot" | "subscribe" | "ensure" | "clear" | "restart" | "variables" | "deleteVariable">
  & Partial<Pick<PythonToolClient, "prepareHandoff" | "resumeAfterHandoff" | "hasInFlightCell" | "processRoot">>;
export interface PythonToolHooks {
  readonly onFailure?: (failure: KernelFailure) => void;
  readonly codeMode?: boolean;
  readonly environment?: Readonly<Record<string, string>>;
  readonly hideToolDeclaration?: (name: string) => boolean;
  readonly allowGatewayTool?: (name: string) => boolean;
  readonly fileReadNotice?: string;
  readonly kernelCapabilities?: (name: string) => boolean;
  readonly outputOptions?: TerminalOptions;
  readonly executionPolicy?: () => KernelExecutionPolicy;
  /** Optional local assembly ceiling; bundled Python uses the generation's configured capacity. */
  readonly runnerMaxActiveCells?: number;
  readonly clock?: KernelClock;
  readonly libraryEntries?: () => readonly unknown[];
  readonly prelude?: (scoped?: boolean) => Promise<string>;
  readonly onToolCatalog?: (helpers: KernelHelper[]) => void;
  readonly onTelemetry?: (event: KernelTelemetry) => void;
  readonly binDir?: string;
}
export interface KernelConfiguration {
  readonly target: string;
  readonly python: string;
  readonly bun?: { readonly storeDir: string; readonly acquire: () => TargetLease; readonly packages?: BunPackages };
  readonly cwd: string;
  readonly acquire: () => Promise<TargetEnvironmentLease>;
  readonly processWindow: ProcessWindowLimits;
  readonly memoryMax: string;
  readonly memorySwapMax: string;
  readonly scoped: boolean;
}
export interface CapturedImage { readonly mimeType: string; readonly data: string }
export type CapturedOutput = { text: string; tail: string; omittedChars: number; truncated: boolean };

export type { KernelFailure } from "./process/kernel-failure.ts";
