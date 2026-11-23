import { interruptCommand } from "./interrupt-command.ts";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { timer } from "./start-timer.ts";

export function hardTimeout(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command, timeoutMs: number): void {
    if (timeoutMs === 0) return;
    command.timeoutTimer = timer(() => {
      if (entry.closed || command.status !== "running") return;
      command.killing = true;
      interruptCommand(ctx, entry, command);
    }, timeoutMs);
  }
