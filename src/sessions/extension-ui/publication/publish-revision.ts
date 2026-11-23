import type { UiContext } from "../ui-types.ts";

export function publish(ctx: UiContext): void {
    if (ctx.disposed) return;
    ctx.revision += 1;
    for (const listener of [...ctx.listeners]) {
      try { listener(); } catch { /* observers cannot alter host state */ }
    }
  }
