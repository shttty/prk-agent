import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "../output/format-result.ts";
import { resetQuiet } from "../notifications/reset-quiet.ts";
import { foreground } from "../waiting/foreground.ts";
import { checkSignal } from "../waiting/check-signal.ts";
import { yieldTime } from "../waiting/parse-yield-time.ts";
import { existing } from "../lifecycle/get-existing-terminal.ts";
import type { TerminalResult } from "../model-terminals-types.ts";
import type { TerminalKey } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { keyBytes } from "./encode-key-bytes.ts";

export async function key(ctx: ModelTerminalsContext, input: TerminalKey, signal?: AbortSignal): Promise<TerminalResult> {
      const bytes = keyBytes(input.keys);
      const yieldMs = yieldTime(ctx, input.yield_s);
      checkSignal(signal);
      const entry = await existing(ctx, input.name ?? "main");
      if (!entry || entry.closed) throw new WireError("NOT_FOUND", "No running terminal exists; use terminal_textsend to open one.");
      checkSignal(signal);
      if (entry.integration === "unavailable") {
        ctx.terminals.input(ctx.sessionId, entry.name, bytes);
        await entry.parsed;
        return result(ctx, entry);
      }
      resetQuiet(ctx, entry);
      ctx.terminals.input(ctx.sessionId, entry.name, bytes);
      await foreground(ctx, entry, entry.current, yieldMs, signal);
      return result(ctx, entry);
    }
