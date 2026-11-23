import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { TargetFileContext } from "../target-files/files-types.ts";
import type { TerminalOptions } from "../../config/terminal/terminal-options.ts";
import type { TerminalSummary, WorkspaceTerminals } from "../terminals/terminals-types.ts";
import type { ShellIntegrationStatus } from "../terminals/terminals-types.ts";
import type { IMarker } from "@xterm/headless";
import type { Terminal as HeadlessTerminal } from "@xterm/headless";

export type TerminalResult = {
  name: string;
  command_id: string | null;
  command: string;
  status: "done" | "running" | "killed" | "unavailable";
  integration?: ShellIntegrationStatus;
  note?: string;
  exit_code: number | null;
  cwd: string;
  duration_ms: number;
  output: string;
  truncated: boolean;
  total_bytes: number;
};
export type TerminalNotice = { kind: "done" | "quiet" | "exit" | "warning"; quiet_ms?: number; result: TerminalResult };
export interface TerminalSend { text: string; name?: string; yield_s?: number; timeout_s?: number; restart?: boolean; quiet_notify?: boolean; output_brake?: boolean }
export interface TerminalKey { keys: string; name?: string; yield_s?: number }
export interface TerminalRead { name?: string; raw?: boolean; command?: string; offset?: number; yield_s?: number }
export interface TerminalSet { name?: string; quiet_notify?: boolean; output_brake?: boolean }
export type TerminalSetResult = { name: string; quiet_notify: boolean; output_brake: boolean; note?: string };
export type TerminalListEntry = { name: string; owner: "model" | "human"; label: string; integration: ShellIntegrationStatus; note?: string };
export type TerminalListResult = { terminals: TerminalListEntry[] };
export interface ModelTerminals {
  list(): Promise<TerminalListResult>;
  getSnapshot(): readonly TerminalSummary[];
  subscribeState(listener: (terminals: readonly TerminalSummary[]) => void): () => void;
  send(input: TerminalSend, signal?: AbortSignal): Promise<TerminalResult>;
  key(input: TerminalKey, signal?: AbortSignal): Promise<TerminalResult>;
  interrupt(name: string, generation: string, commandId: string): { requested: boolean };
  read(input: TerminalRead, signal?: AbortSignal): Promise<TerminalResult>;
  set(input: TerminalSet): Promise<TerminalSetResult>;
  close(name: string): Promise<{ closed: true }>;
  closeAll(): Promise<void>;
  hasRunning(): boolean;
  subscribe(listener: (event: TerminalNotice) => void): () => void;
}
export interface ModelTerminalContext {
  sessionId: string;
  context: TargetFileContext;
  environment?: Readonly<Record<string, string>>;
  terminals: Pick<WorkspaceTerminals, "has" | "open" | "list" | "integration" | "input" | "resize" | "close" | "subscribe">;
  options: TerminalOptions;
  limits: LimitsOptions;
}

export type Timer = NodeJS.Timeout;
export interface Command {
  id: string;
  name: string;
  text: string;
  model: boolean;
  background: boolean;
  awaitingStart: boolean;
  started: number;
  ended?: number;
  status: "running" | "done" | "killed";
  killing: boolean;
  rebuilding?: boolean;
  note?: string;
  exitCode: number | null;
  cwd: string;
  marker?: IMarker;
  column: number;
  prefix: string[];
  ptyBytes: number;
  retained?: { head: string; tail: string; bytes: number; headLimit: number; tailLimit: number };
  output?: string;
  lastOutput: number;
  quietBase: number;
  quietLevel: number;
  quietTimer?: Timer;
  timeoutTimer?: Timer;
  restartTimer?: Timer;
  waiters: Set<() => void>;
}
export interface ModelTerminal {
  name: string;
  terminal: HeadlessTerminal;
  owner: "model" | "human";
  integration: ShellIntegrationStatus;
  cwd: string;
  quietNotify: boolean;
  outputBrake: boolean;
  pendingOutput: string;
  current?: Command;
  prompt?: IMarker;
  promptColumn: number;
  expectingPromptAfterDone?: boolean;
  ready: Promise<void>;
  resolveReady(): void;
  rejectReady(error: Error): void;
  readyTimer?: Timer;
  parsed: Promise<void>;
  unsubscribe(): void;
  closed: boolean;
  disposed: boolean;
  suppress: boolean;
  replaying: boolean;
}
