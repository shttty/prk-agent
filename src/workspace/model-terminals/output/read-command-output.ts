import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import { bufferText } from "./read-buffer-text.ts";
import { renderRetained } from "./render-retained.ts";

export function output(entry: ModelTerminal, command: Command): string {
    if (command.output !== undefined) return command.output;
    const buffer = entry.terminal.buffer.active;
    const start = command.marker && !command.marker.isDisposed ? command.marker.line : 0;
    const pending = bufferText(entry.terminal, start, command.column, buffer.baseY + buffer.cursorY, buffer.cursorX);
    return command.retained ? renderRetained(command.retained, pending) : command.prefix.join("") + pending;
  }
