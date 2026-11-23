import { Buffer } from "node:buffer";
import type { Command, ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { retainText } from "./retain-text.ts";

/** Returns the command crossing the limit once; framing is excluded by the writer. */
export function countPtyOutput(ctx: ModelTerminalsContext, entry: ModelTerminal, text: string): Command | undefined {
  const command = entry.current;
  if (!command || command.status !== "running" || command.awaitingStart) return;
  command.ptyBytes += Buffer.byteLength(text);
  if (command.retained || command.ptyBytes <= ctx.options.commandOutputLimitBytes) return;
  command.retained = { head: "", tail: "", bytes: 0,
    headLimit: ctx.options.truncatedHeadBytes, tailLimit: ctx.options.truncatedTailBytes };
  for (const prefix of command.prefix) retainText(command.retained, prefix);
  command.prefix = [];
  command.note = command.model && entry.outputBrake
    ? `Output exceeded commandOutputLimitBytes (${ctx.options.commandOutputLimitBytes} PTY bytes); automatically interrupted with C-c. Only head/tail output is retained; the middle cannot be recovered.`
    : `Output exceeded commandOutputLimitBytes (${ctx.options.commandOutputLimitBytes} PTY bytes); only head/tail output is retained; the middle cannot be recovered.`;
  return command;
}
