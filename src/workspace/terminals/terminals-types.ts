
export type TerminalEvent = { type: "stdout"; data: string } | { type: "closed" } | { type: "resize"; rows: number; cols: number };
export interface TerminalSummary {
  name: string;
  generation: string;
  connectionStatus: string;
  owner?: "model";
  label?: string;
  cleanup?: "linux-pdeathsig" | "normal-close-only";
  runningCommand?: { id: string; text: string; startedAt: number };
}
export interface TerminalSnapshot extends TerminalSummary {
  replay: string;
  rows: number;
  cols: number;
}

export interface ModelTerminalStartup {
  owner: "model";
  label: string;
  shellCommand: readonly string[];
}

export type ShellIntegrationStatus = "ready" | "unavailable";

export interface WorkspaceTerminals {
  has(sessionId: string, name: string): boolean;
  open(sessionId: string, context: { cwd: string }, name: string, startup?: ModelTerminalStartup): Promise<TerminalSnapshot>;
  list(sessionId: string): { terminals: TerminalSummary[] };
  modelShellPid(sessionId: string, name: string): number | undefined;
  integration(sessionId: string, name: string): Promise<ShellIntegrationStatus>;
  input(sessionId: string, name: string, data: string): { sent: true };
  resize(sessionId: string, name: string, rows: number, cols: number): { resized: true };
  close(sessionId: string, name: string): Promise<{ closed: true }>;
  subscribe(sessionId: string, name: string, listener: Listener): { snapshot: TerminalSnapshot; unsubscribe(): void };
  closeSession(sessionId: string): Promise<void>;
  shutdown(): Promise<void>;
}

export type Listener = (event: TerminalEvent) => void;
