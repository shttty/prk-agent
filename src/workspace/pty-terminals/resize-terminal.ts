import { WireError } from "../../gateway/wire/create-error.ts";
import type { PtyContext } from "./terminal-state.ts";
import { publishEvent } from "./publish-event.ts";

export function resizeTerminal(ctx: PtyContext, sessionId: string, name: string, rows: number, cols: number): { resized: true } {
  if (![rows, cols].every((value) => Number.isSafeInteger(value) && value >= 1 && value <= 4096)) throw new WireError("INVALID_REQUEST", "PTY dimensions must be integers in 1..4096.");
  const entry = ctx.sessions.get(sessionId)?.get(name);
  if (!entry?.terminal || entry.closed || entry.lease?.signal.aborted) throw new WireError("UNAVAILABLE", "Terminal is not connected.");
  entry.terminal.resize(cols, rows);
  entry.rows = rows;
  entry.cols = cols;
  publishEvent(entry, { type: "resize", rows, cols });
  return { resized: true };
}
