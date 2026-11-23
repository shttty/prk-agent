import { result } from "../output/format-result.ts";
import type { TerminalNotice } from "../model-terminals-types.ts";
import type { Command } from "../model-terminals-types.ts";
import type { ModelTerminal } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export function publish(ctx: ModelTerminalsContext, entry: ModelTerminal, command: Command, kind: TerminalNotice["kind"], quietMs?: number): void {
    if (ctx.stopped || entry.suppress || entry.replaying || !command.model || (!command.background && kind !== "warning")) return;
    const event: TerminalNotice = { kind, ...(quietMs === undefined ? {} : { quiet_ms: quietMs }), result: result(ctx, entry, command) };
    for (const listener of [...ctx.listeners]) {
      try { listener(event); } catch { ctx.listeners.delete(listener); }
    }
  }
