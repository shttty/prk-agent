import { close } from "./close.ts";
import { dispose } from "./dispose.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";
import { clearTimers } from "../timing/clear-timers.ts";

export async function closeAll(ctx: ModelTerminalsContext): Promise<void> {
      ctx.stopped = true;
      ctx.listeners.clear();
      const humanNames = new Set(ctx.terminals.list(ctx.sessionId).terminals.filter((entry) => entry.owner !== "model").map((entry) => entry.name));
      for (const entry of ctx.entries.values()) dispose(ctx, entry);
      for (const command of ctx.history.values()) clearTimers(command);
      ctx.history.clear();
      ctx.historyBytes = 0;
      const names = new Set([
        ...[...ctx.entries.keys(), ...ctx.openings.keys(), ...ctx.restartTasks.keys()].filter((name) => !humanNames.has(name)),
        ...ctx.terminals.list(ctx.sessionId).terminals.filter((entry) => entry.owner === "model").map((entry) => entry.name),
      ]);
      const results = await Promise.allSettled([...names].map((name) => close(ctx, name)));
      ctx.entries.clear();
      ctx.stateListeners.clear();
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
