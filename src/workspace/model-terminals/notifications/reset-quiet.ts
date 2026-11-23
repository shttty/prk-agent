import { scheduleQuiet } from "./schedule-quiet.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export function resetQuiet(ctx: ModelTerminalsContext, entry: ModelTerminal): void {
    const command = entry.current;
    if (!command || command.status !== "running") return;
    command.quietLevel = 0;
    command.quietBase = Date.now();
    scheduleQuiet(ctx, entry, command);
  }
