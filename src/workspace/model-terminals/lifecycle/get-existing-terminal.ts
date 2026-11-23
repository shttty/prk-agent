import { WireError } from "../../../gateway/wire/create-error.ts";
import { open } from "./open.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export async function existing(ctx: ModelTerminalsContext, name: string): Promise<ModelTerminal | undefined> {
    if (ctx.stopped) throw new WireError("UNAVAILABLE", "Model terminals are closed.");
    await ctx.restartTasks.get(name);
    const failure = ctx.restartErrors.get(name);
    if (failure) throw failure;
    await ctx.openings.get(name);
    const entry = ctx.entries.get(name);
    if (entry && !entry.closed) {
      await entry.ready;
      await entry.parsed;
      return entry;
    }
    if (ctx.terminals.has(ctx.sessionId, name)) return open(ctx, name);
    return entry;
  }
