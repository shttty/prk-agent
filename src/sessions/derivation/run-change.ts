import type { DerivationContext } from "./derivation-state.ts";

export async function change<T>(ctx: DerivationContext, sessionId: string, action: () => Promise<T>): Promise<T> {
    if (ctx.closing.has(sessionId) || ctx.busy.has(sessionId)) throw new Error("Session lifecycle is already changing.");
    ctx.busy.add(sessionId);
    try { return await action(); }
    finally { ctx.busy.delete(sessionId); }
  }
