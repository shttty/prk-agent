import { scheduleQuiet } from "../notifications/schedule-quiet.ts";
import type { Timer } from "../model-terminals-types.ts";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { timer } from "../timing/start-timer.ts";

export async function foreground(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command | undefined, yieldMs: number, signal?: AbortSignal): Promise<void> {
    if (!command || command.status !== "running") return;
    command.background = false;
    clearTimeout(command.quietTimer);
    const started = Date.now();
    const until = started + yieldMs;
    await new Promise<void>((resolve) => {
      let handle: Timer | undefined;
      const finishWait = () => { clearTimeout(handle); command.waiters.delete(check); signal?.removeEventListener("abort", finishWait); resolve(); };
      const check = () => {
        clearTimeout(handle);
        if (entry.closed || command.status !== "running" || signal?.aborted) { finishWait(); return; }
        const remaining = Math.min(until - Date.now(), Math.max(started, command.lastOutput) + ctx.options.foregroundQuietMs - Date.now());
        if (remaining <= 0) { finishWait(); return; }
        handle = timer(check, remaining);
      };
      command.waiters.add(check);
      signal?.addEventListener("abort", finishWait, { once: true });
      check();
    });
    await entry.parsed;
    if (command.status === "running") {
      command.background = true;
      scheduleQuiet(ctx, entry, command);
    }
  }
