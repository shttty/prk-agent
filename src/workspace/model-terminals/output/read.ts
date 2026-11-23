import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "./format-result.ts";
import { foreground } from "../waiting/foreground.ts";
import { checkSignal } from "../waiting/check-signal.ts";
import { yieldTime } from "../waiting/parse-yield-time.ts";
import { existing } from "../lifecycle/get-existing-terminal.ts";
import type { TerminalResult } from "../model-terminals-types.ts";
import type { TerminalRead } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export async function read(ctx: ModelTerminalsContext, input: TerminalRead, signal?: AbortSignal): Promise<TerminalResult> {
      const offset = input.offset ?? 0;
      if (!Number.isSafeInteger(offset) || offset < 0) throw new WireError("INVALID_REQUEST", "offset must be a nonnegative UTF-8 byte offset.");
      const yieldMs = input.yield_s === undefined ? 0 : yieldTime(ctx, input.yield_s);
      checkSignal(signal);
      const name = input.name ?? "main";
      const entry = await existing(ctx, name);
      const command = input.command === undefined || entry?.current?.id === input.command ? entry?.current : ctx.history.get(input.command);
      if (input.command !== undefined && (!command || command.name !== name)) throw new WireError("NOT_FOUND", "Command output is no longer retained for this terminal.");
      if (entry) await foreground(ctx, entry, command, yieldMs, signal);
      return result(ctx, entry, command, input.raw, input.command === undefined ? undefined : offset);
    }
