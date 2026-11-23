import type { ModelTerminalsContext } from "../terminal-state.ts";

export function hasRunning(ctx: ModelTerminalsContext): boolean {
      for (const entry of ctx.entries.values()) if (entry.current?.status === "running" && entry.current.model) return true;
      return false;
    }
