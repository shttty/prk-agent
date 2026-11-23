import { WireError } from "../../gateway/wire/create-error.ts";
import type { Listener, TerminalSnapshot } from "../terminals/terminals-types.ts";
import type { PtyContext } from "./terminal-state.ts";
import { snapshotTerminal } from "./snapshot-terminal.ts";

export function subscribeTerminal(ctx: PtyContext, sessionId: string, name: string, listener: Listener): { snapshot: TerminalSnapshot; unsubscribe(): void } {
  const entry = ctx.sessions.get(sessionId)?.get(name);
  if (!entry || entry.closed) throw new WireError("NOT_FOUND", "Terminal no longer exists.");
  entry.listeners.add(listener);
  return { snapshot: snapshotTerminal(entry), unsubscribe: () => { entry.listeners.delete(listener); } };
}
