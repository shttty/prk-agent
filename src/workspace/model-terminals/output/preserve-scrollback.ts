import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { bufferText } from "./read-buffer-text.ts";
import { retainText } from "./retain-text.ts";

export function preserveScrollback(ctx: ModelTerminalsContext, entry: ModelTerminal, force = false): void {
    const command = entry.current;
    if (!command || command.status !== "running" || !command.marker || command.marker.isDisposed) return;
    const buffer = entry.terminal.buffer.active;
    if (buffer.type !== "normal" || (!force && !command.retained && buffer.length < ctx.options.scrollbackLines + entry.terminal.rows - 8)) return;
    const end = buffer.baseY;
    if (end <= command.marker.line) return;
    const text = bufferText(entry.terminal, command.marker.line, command.column, end, 0);
    if (command.retained) retainText(command.retained, text);
    else command.prefix.push(text);
    command.marker.dispose();
    command.marker = entry.terminal.registerMarker(-buffer.cursorY);
    command.column = 0;
  }
