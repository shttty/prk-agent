import { publish } from "./publish.ts";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { timer } from "../timing/start-timer.ts";

export function scheduleQuiet(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command): void {
    clearTimeout(command.quietTimer);
    if (ctx.stopped || entry.closed || !entry.quietNotify || command.status !== "running" || !command.model || !command.background) return;
    const threshold = ctx.options.quietLadderMs[Math.min(command.quietLevel, ctx.options.quietLadderMs.length - 1)]!;
    const from = Math.max(command.lastOutput, command.quietBase);
    command.quietTimer = timer(() => {
      if (entry.current !== command || command.status !== "running") return;
      publish(ctx, entry, command, "quiet", Date.now() - command.lastOutput);
      command.quietLevel = Math.min(command.quietLevel + 1, ctx.options.quietLadderMs.length - 1);
      command.quietBase = Date.now();
      scheduleQuiet(ctx, entry, command);
    }, from + threshold - Date.now());
  }
