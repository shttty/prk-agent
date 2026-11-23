import type { TerminalSnapshot } from "../terminals/terminals-types.ts";
import type { PtyEntry } from "./terminal-state.ts";

export function snapshotTerminal(entry: PtyEntry): TerminalSnapshot {
  return {
    name: entry.name, generation: entry.generation,
    cleanup: entry.cleanup,
    connectionStatus: entry.closed ? "disconnected" : entry.terminal ? "connected" : "connecting",
    ...(entry.startup ? { owner: entry.startup.owner, label: entry.startup.label } : {}),
    rows: entry.rows, cols: entry.cols, replay: entry.replay.snapshot(),
  };
}
