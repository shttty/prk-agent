import type { TerminalSummary } from "../../terminals/terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export function subscribeState(ctx: ModelTerminalsContext, listener: (terminals: readonly TerminalSummary[]) => void): () => void {
  ctx.stateListeners.add(listener);
  return () => { ctx.stateListeners.delete(listener); };
}
