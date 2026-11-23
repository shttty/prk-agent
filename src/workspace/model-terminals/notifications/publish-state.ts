import type { ModelTerminalsContext } from "../terminal-state.ts";
import { snapshot } from "../output/get-snapshot.ts";

export function publishState(ctx: ModelTerminalsContext): void {
  if (!ctx.stateListeners.size) return;
  const terminals = snapshot(ctx);
  for (const listener of [...ctx.stateListeners]) {
    try { listener(terminals); } catch { ctx.stateListeners.delete(listener); }
  }
}
