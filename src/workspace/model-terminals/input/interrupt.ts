import type { ModelTerminalsContext } from "../terminal-state.ts";
import { interruptCommand } from "../timing/interrupt-command.ts";

export function interrupt(ctx: ModelTerminalsContext, name: string, generation: string, commandId: string): { requested: boolean } {
  const entry = ctx.entries.get(name);
  const command = entry?.current;
  if (ctx.stopped || !entry || entry.closed || entry.owner !== "model" || !command?.model || command.status !== "running" || command.id !== commandId) return { requested: false };
  const terminal = ctx.terminals.list(ctx.sessionId).terminals.find((item) => item.name === name);
  if (terminal?.generation !== generation) return { requested: false };
  interruptCommand(ctx, entry, command);
  return { requested: true };
}
