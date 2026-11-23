import { WireError } from "../../../gateway/wire/create-error.ts";
import { Buffer } from "node:buffer";
import { compactTerminalOutput } from "../../terminal-output/compact-terminal-output.ts";
import { output } from "./read-command-output.ts";
import type { TerminalResult } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { bytePage } from "./read-byte-page.ts";
import { screen } from "./read-screen.ts";

export function result(ctx: ModelTerminalsContext, entry: ModelTerminal | undefined, command = entry?.current, raw = false, page?: number): TerminalResult {
    if (!entry && (!command || raw)) throw new WireError("NOT_FOUND", "No terminal screen exists; use terminal_textsend to open one.");
    if (entry?.integration === "unavailable" && page === undefined) {
      const text = raw ? screen(entry) : screen(entry, 12);
      const rendered = raw ? { output: text, truncated: false } : compactTerminalOutput(text, "", ctx.options);
      return {
        name: entry.name, command_id: null, command: "", status: "unavailable", integration: "unavailable",
        note: "命令级跟踪不可用 (command-level tracking unavailable); shell integration markers did not initialize on this terminal. Use terminal_read with raw=true to inspect the visible screen.",
        exit_code: null, cwd: entry.cwd, duration_ms: 0, ...rendered, total_bytes: Buffer.byteLength(text),
      };
    }
    const full = command?.output ?? (command && entry ? output(entry, command) : "");
    const total = Buffer.byteLength(full);
    let rendered: { output: string; truncated: boolean };
    if (raw) rendered = { output: screen(entry!), truncated: false };
    else if (page !== undefined) {
      const text = bytePage(full, page, ctx.options.outputBytes);
      rendered = { output: text, truncated: page + Buffer.byteLength(text) < total };
    } else {
      const runningScreen = command?.status === "running" && !command.retained;
      rendered = compactTerminalOutput(runningScreen ? screen(entry!, 12) : full, command?.text ?? "", ctx.options, runningScreen ? undefined : command?.id);
    }
    return { name: command?.name ?? entry!.name, command_id: command?.id ?? null, command: command?.text ?? "",
      status: command?.status ?? "done", ...(entry ? { integration: entry.integration } : {}),
      exit_code: command?.exitCode ?? null, cwd: command?.cwd ?? entry!.cwd,
      ...(command?.status === "running" ? { note: entry?.quietNotify
        ? "Running in the background. A terminal event will start a new turn when it finishes or goes quiet; end your turn or do other work instead of polling terminal_read."
        : "Running in the background (quiet_notify is off). A terminal event will start a new turn when it finishes; enable quiet_notify via terminal_set if you also need silence wakeups, and do not sleep or poll terminal_read." } : {}),
      ...(command?.note ? { note: command.note } : {}),
      duration_ms: command ? Math.max(0, (command.ended ?? Date.now()) - command.started) : 0,
      ...rendered, truncated: rendered.truncated || Boolean(command?.retained), total_bytes: total };
  }
