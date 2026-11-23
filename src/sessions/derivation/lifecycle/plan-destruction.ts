import { info } from "../metadata/read-info.ts";
import { visit } from "./visit.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function plan(ctx: DerivationContext, sessionId: string) {
    ctx.env.get(sessionId);
    const order: string[] = [];
    const seen = new Set<string>();
    
    visit(ctx, sessionId, seen, order);
    const retained = ctx.env.list().flatMap((entry) => {
      const state = info(ctx, entry.sessionId);
      return state && seen.has(state.createdBy) && !seen.has(entry.sessionId)
        ? [{ sessionId: entry.sessionId, createdBy: state.createdBy, owner: state.owner }] : [];
    });
    return { destroyed: order.map((node) => {
      const owner = info(ctx, node)?.owner;
      return { sessionId: node, owner: owner ?? null };
    }), retained };
  }
