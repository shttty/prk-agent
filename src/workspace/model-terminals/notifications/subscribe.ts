import type { TerminalNotice } from "../model-terminals-types.ts";
import type { ModelTerminalsContext } from "../terminal-state.ts";

export function subscribe(ctx: ModelTerminalsContext, listener: (event: TerminalNotice) => void): () => void { ctx.listeners.add(listener); return () => { ctx.listeners.delete(listener); }; }
