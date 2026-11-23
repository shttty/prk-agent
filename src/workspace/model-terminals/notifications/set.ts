import type { TerminalSet } from "../model-terminals-types.ts";
import type { TerminalSetResult } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { existing } from "../lifecycle/get-existing-terminal.ts";
import { resetQuiet } from "./reset-quiet.ts";

export async function setTerminal(ctx: ModelTerminalsContext, input: TerminalSet): Promise<TerminalSetResult> {
  const name = input.name ?? "main";
  const entry = await existing(ctx, name);
  if (!entry || entry.closed) throw new WireError("NOT_FOUND", "No running terminal exists; use terminal_textsend to open one.");
  const previous = entry.quietNotify;
  if (input.output_brake !== undefined) entry.outputBrake = input.output_brake;
  if (input.quiet_notify !== undefined) {
    entry.quietNotify = input.quiet_notify;
    if (!input.quiet_notify) {
      if (entry.current) clearTimeout(entry.current.quietTimer);
    } else if (!previous) {
      resetQuiet(ctx, entry);
    }
  }
  return {
    name: entry.name,
    quiet_notify: entry.quietNotify,
    output_brake: entry.outputBrake,
    ...(entry.integration === "unavailable" ? { note: "命令级跟踪不可用 (command-level tracking unavailable); quiet_notify and output_brake require shell marker integration." } : {}),
  };
}
