import type { TerminalSummary } from "../terminals/terminals-types.ts";
import type { PtyContext } from "./terminal-state.ts";

export function listTerminals(ctx: PtyContext, sessionId: string): { terminals: TerminalSummary[] } {
  return { terminals: [...(ctx.sessions.get(sessionId)?.values() ?? [])].map((entry) => ({
    name: entry.name, generation: entry.generation,
    cleanup: entry.cleanup,
    connectionStatus: entry.terminal ? "connected" : "connecting",
    ...(entry.startup ? { owner: entry.startup.owner, label: entry.startup.label } : {}),
  })) };
}
