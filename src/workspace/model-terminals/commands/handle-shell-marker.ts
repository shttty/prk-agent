import { begin } from "./begin-command.ts";
import { finish } from "./finish-command.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { bufferText } from "../output/read-buffer-text.ts";

export function osc(ctx: ModelTerminalsContext, entry: ModelTerminal, data: string): boolean {
    if (entry.owner === "human" && entry.integration === "unavailable") return true;
    const [kind, status] = data.split(";");
    const terminal = entry.terminal;
    const buffer = terminal.buffer.active;
    if (kind === "A") {
      const command = entry.current;
      // A follows PROMPT_COMMAND, unlike B on a readline redisplay. If D already
      // settled the preceding command, its A can still arrive after the next send.
      if (!entry.expectingPromptAfterDone && command?.status === "running" && command.awaitingStart) {
        command.killing = true;
        command.note = "Shell returned to the prompt before the command started.";
        finish(ctx, entry, command, null);
      }
      entry.expectingPromptAfterDone = false;
    } else if (kind === "B") {
      entry.expectingPromptAfterDone = false;
      // Readline may redraw PS1 while accepting a paste, before command-start C.
      if (entry.current?.status === "running" && !entry.current.awaitingStart) finish(ctx, entry, entry.current, null);
      entry.prompt?.dispose();
      entry.prompt = terminal.registerMarker();
      entry.promptColumn = buffer.cursorX;
      entry.resolveReady();
    } else if (kind === "C") {
      let command = entry.current;
      if (!command || command.status !== "running") {
        const text = entry.prompt && !entry.prompt.isDisposed
          ? bufferText(terminal, entry.prompt.line, entry.promptColumn, buffer.baseY + buffer.cursorY, buffer.cursorX).trimEnd() : "";
        command = begin(ctx, entry, text, false);
      }
      if (command.awaitingStart || !command.model) {
        command.marker?.dispose();
        command.marker = terminal.registerMarker();
        command.column = buffer.cursorX;
        command.prefix = [];
        command.awaitingStart = false;
      }
    } else if (kind === "D") {
      entry.expectingPromptAfterDone = true;
      if (entry.current?.status === "running") {
        const code = status !== undefined && /^-?\d+$/u.test(status) ? Number(status) : null;
        finish(ctx, entry, entry.current, code);
      }
    }
    return true;
  }
