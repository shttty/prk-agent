import type { TerminalListResult } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export async function listTerminals(ctx: ModelTerminalsContext): Promise<TerminalListResult> {
  const { terminals } = ctx.terminals.list(ctx.sessionId);
  return {
    terminals: await Promise.all(terminals.map(async (terminal) => {
      const owner = terminal.owner === "model" ? "model" as const : "human" as const;
      const integration = await ctx.terminals.integration(ctx.sessionId, terminal.name);
      return {
        name: terminal.name,
        owner,
        label: terminal.label ?? terminal.name,
        integration,
        ...(integration === "unavailable" ? { note: "命令级跟踪不可用 (command-level tracking unavailable); use terminal_read with raw=true to inspect the visible screen." } : {}),
      };
    })),
  };
}
