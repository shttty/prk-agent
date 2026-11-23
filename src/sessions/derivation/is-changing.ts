import type { DerivationContext } from "./derivation-state.ts";

export function isChanging(ctx: DerivationContext, sessionId: string) { return ctx.busy.has(sessionId) || ctx.closing.has(sessionId); }
