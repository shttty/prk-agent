import { randomUUID } from "node:crypto";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { publishState } from "../notifications/publish-state.ts";

export function begin(ctx: ModelTerminalsContext, entry: ModelTerminal, text: string, model: boolean): Command {
    const now = Date.now();
    const command: Command = { id: randomUUID(), name: entry.name, text, model, background: false, awaitingStart: model,
      started: now, status: "running", killing: false, exitCode: null, cwd: entry.cwd,
      marker: entry.terminal.registerMarker(), column: entry.terminal.buffer.active.cursorX, prefix: [], ptyBytes: 0,
      lastOutput: now, quietBase: now, quietLevel: 0, waiters: new Set() };
    entry.current = command;
    publishState(ctx);
    return command;
  }
