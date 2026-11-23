import { WireError } from "../../../gateway/wire/create-error.ts";
import { open } from "../lifecycle/open.ts";
import { close } from "../lifecycle/close.ts";
import { result } from "../output/format-result.ts";
import { begin } from "../commands/begin-command.ts";
import { resetQuiet } from "../notifications/reset-quiet.ts";
import { hardTimeout } from "../timing/hard-timeout.ts";
import { foreground } from "../waiting/foreground.ts";
import { checkSignal } from "../waiting/check-signal.ts";
import { yieldTime } from "../waiting/parse-yield-time.ts";
import type { TerminalResult } from "../model-terminals-types.ts";
import type { TerminalSend } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { milliseconds } from "../timing/parse-duration.ts";
import { textBytes } from "./encode-text-bytes.ts";

export async function send(ctx: ModelTerminalsContext, input: TerminalSend, signal?: AbortSignal): Promise<TerminalResult> {
      const yieldMs = yieldTime(ctx, input.yield_s);
      const timeoutMs = milliseconds(input.timeout_s, ctx.options.timeoutMs, 2_147_483_647, "timeout_s");
      checkSignal(signal);
      const name = input.name ?? "main";
      const previous = ctx.terminals.list(ctx.sessionId).terminals.find((candidate) => candidate.name === name);
      if (input.restart) await close(ctx, name);
      const entry = await open(ctx, name, false, input.restart && previous && previous.owner !== "model" ? "human" : undefined);
      checkSignal(signal);
      if (input.quiet_notify !== undefined) entry.quietNotify = input.quiet_notify;
      if (input.output_brake !== undefined) entry.outputBrake = input.output_brake;
      if (input.restart && input.text === "") return result(ctx, entry);
      if (entry.integration === "unavailable") {
        if (timeoutMs > 0) throw new WireError("UNAVAILABLE", "Hard timeout requires command-level shell tracking; no input was sent.");
        const bytes = textBytes(input.text, entry.terminal.modes.bracketedPasteMode, false);
        ctx.terminals.input(ctx.sessionId, name, bytes);
        await entry.parsed;
        return result(ctx, entry);
      }
      let command = entry.current;
      const atPrompt = !command || command.status !== "running";
      const bytes = textBytes(input.text, entry.terminal.modes.bracketedPasteMode, atPrompt);
      if (atPrompt) {
        if (!input.text.trim()) {
          if (!entry.quietNotify && entry.current) clearTimeout(entry.current.quietTimer);
          ctx.terminals.input(ctx.sessionId, name, bytes);
          return result(ctx, entry);
        }
        command = begin(ctx, entry, input.text, true);
        hardTimeout(ctx, entry, command, timeoutMs);
      }
      resetQuiet(ctx, entry);
      ctx.terminals.input(ctx.sessionId, name, bytes);
      await foreground(ctx, entry, command, yieldMs, signal);
      await ctx.restartTasks.get(name);
      return result(ctx, entry, command);
    }
