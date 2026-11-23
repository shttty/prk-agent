import type { ClientContext } from "../client-state.ts";
import type { TerminalEventListener } from "../client-types.ts";

export function subscribeTerminalEvents(ctx: ClientContext, listener: TerminalEventListener) {
  ctx.terminalListeners.add(listener); return () => { ctx.terminalListeners.delete(listener); };
}
