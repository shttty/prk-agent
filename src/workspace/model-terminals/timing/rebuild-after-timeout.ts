import type { Command, ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { open } from "../lifecycle/open.ts";
import { dispose } from "../lifecycle/dispose.ts";
import { finish } from "../commands/finish-command.ts";
import { output } from "../output/read-command-output.ts";

export async function rebuildAfterTimeout(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command): Promise<void> {
  command.rebuilding = true;
  command.output = output(entry, command);
  let ended = false;
  try {
    // Close must confirm the old shell ended before publishing killed or rebuilding.
    await ctx.terminals.close(ctx.sessionId, entry.name);
    ended = true;
    dispose(ctx, entry);
    ctx.entries.delete(entry.name);
    if (!ctx.stopped) {
      const replacement = await open(ctx, entry.name, true, entry.owner);
      replacement.quietNotify = entry.quietNotify;
      replacement.outputBrake = entry.outputBrake;
      if (entry.owner === "human") command.note = [command.note, "人类终端已因硬超时重建"].filter(Boolean).join("; ");
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Terminal hard-timeout rebuild failed.");
    ctx.restartErrors.set(entry.name, failure);
    if (ended) command.note = [command.note, `Hard timeout ended the terminal, but rebuilding failed: ${failure.message}`].filter(Boolean).join("; ");
  } finally {
    command.rebuilding = false;
    if (ended) {
      entry.suppress = false;
      finish(ctx, entry, command, null);
    }
  }
}
