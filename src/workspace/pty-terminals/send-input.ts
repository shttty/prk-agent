import { validatePtyInput } from "./validate-input.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { PtyContext } from "./terminal-state.ts";

export function sendInput(ctx: PtyContext, sessionId: string, name: string, data: string): { sent: true } {
  validatePtyInput(data, ctx.options.workspace.terminalInputBytes);
  const entry = ctx.sessions.get(sessionId)?.get(name);
  if (!entry?.terminal || entry.closed || entry.lease?.signal.aborted) throw new WireError("UNAVAILABLE", "Terminal is not connected.");
  // Original SDK write is synchronous; calls are serialized here, without a PRK input queue.
  // D6: its private request identity is unavailable, so return is not an enqueue/consumption acknowledgement.
  entry.terminal.write(data);
  return { sent: true };
}
