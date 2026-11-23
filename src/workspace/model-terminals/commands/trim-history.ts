import { Buffer } from "node:buffer";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export function trimHistory(ctx: ModelTerminalsContext): void {
    while (ctx.history.size > ctx.options.historyCommands || ctx.historyBytes > ctx.options.historyBytes) {
      const command = ctx.history.values().next().value!;
      ctx.historyBytes -= Buffer.byteLength(command.output ?? "");
      ctx.history.delete(command.id);
      const entry = ctx.entries.get(command.name);
      if (entry?.current === command) entry.current = undefined;
    }
  }
