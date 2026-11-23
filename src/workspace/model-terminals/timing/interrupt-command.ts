import { rebuildAfterTimeout } from "./rebuild-after-timeout.ts";
import type { Command, ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { timer } from "./start-timer.ts";

/** Confirm termination before replacing a terminal whose command ignores Ctrl-C. */
export function interruptCommand(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command): void {
  if (command.restartTimer) return;
  try { ctx.terminals.input(ctx.sessionId, entry.name, "\x03"); }
  catch { /* The rebuild below also handles a disconnected PTY. */ }
  command.restartTimer = timer(() => {
    if (command.status !== "running" || ctx.stopped) return;
    command.killing = true;
    const replacement = rebuildAfterTimeout(ctx, entry, command)
      .finally(() => { ctx.restartTasks.delete(entry.name); });
    ctx.restartTasks.set(entry.name, replacement);
  }, 3000);
}
