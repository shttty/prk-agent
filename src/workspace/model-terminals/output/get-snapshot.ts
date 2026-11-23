import type { TerminalSummary } from "../../terminals/terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { commandLine } from "../commands/command-line.ts";

export function snapshot(ctx: ModelTerminalsContext): readonly TerminalSummary[] {
  return ctx.terminals.list(ctx.sessionId).terminals.map((terminal) => {
    const entry = ctx.entries.get(terminal.name);
    const command = entry?.current;
    return terminal.owner === "model" && !entry?.closed && command?.model && command.status === "running"
      ? { ...terminal, runningCommand: { id: command.id, text: commandLine(command.text), startedAt: command.started } }
      : terminal;
  });
}
