import { dispose } from "./dispose.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export async function close(ctx: ModelTerminalsContext, name: string, replacing = false): Promise<{ closed: true }> {
    if (!replacing) await ctx.restartTasks.get(name);
    const binding = ctx.terminals.list(ctx.sessionId).terminals.find((candidate) => candidate.name === name);
    const pending = ctx.openings.get(name);
    if (pending) await pending.catch(() => undefined);
    const entry = ctx.entries.get(name);
    if (binding) await ctx.terminals.close(ctx.sessionId, name);
    if (entry) { dispose(ctx, entry); ctx.entries.delete(name); }
    ctx.restartErrors.delete(name);
    return { closed: true };
  }
