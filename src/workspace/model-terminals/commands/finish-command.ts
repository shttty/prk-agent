import { Buffer } from "node:buffer";
import { publish } from "../notifications/publish.ts";
import { wake } from "../waiting/notify-waiters.ts";
import { output } from "../output/read-command-output.ts";
import { trimHistory } from "./trim-history.ts";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { clearTimers } from "../timing/clear-timers.ts";
import { publishState } from "../notifications/publish-state.ts";

export function finish(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command, exitCode: number | null, kind: "done" | "exit" = "done"): void {
    if (command.status !== "running" || command.rebuilding) return;
    command.output = output(entry, command);
    command.marker?.dispose();
    command.marker = undefined;
    command.prefix = [];
    if (command.retained) { command.retained.head = ""; command.retained.tail = ""; }
    command.status = command.killing ? "killed" : "done";
    command.exitCode = exitCode;
    command.cwd = entry.cwd;
    command.ended = Date.now();
    publishState(ctx);
    clearTimers(command);
    if (!ctx.stopped) {
      ctx.history.set(command.id, command);
      ctx.historyBytes += Buffer.byteLength(command.output);
    }
    trimHistory(ctx);
    wake(command);
    publish(ctx, entry, command, kind);
  }
