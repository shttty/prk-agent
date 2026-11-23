import type { TerminalEvent } from "../terminals/terminals-types.ts";
import type { PtyEntry } from "./terminal-state.ts";

export function publishEvent(entry: PtyEntry, event: TerminalEvent): void {
  for (const listener of [...entry.listeners]) {
    try { listener(event); }
    catch { entry.listeners.delete(listener); }
  }
}
