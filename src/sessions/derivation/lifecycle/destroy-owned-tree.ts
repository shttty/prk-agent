import { plan } from "./plan-destruction.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function destroy(ctx: DerivationContext, sessionId: string) {
    const selected = plan(ctx, sessionId);
    const nodes = selected.destroyed.map((node) => node.sessionId);
    const changing = nodes.filter((node) => node !== sessionId && (ctx.busy.has(node) || ctx.closing.has(node)));
    if (changing.length) throw new Error(`Session lifecycle is already changing for ${changing.join(", ")}; nothing was destroyed.`);
    for (const node of nodes) ctx.closing.add(node);
    try { await ctx.env.destroy(nodes, sessionId); }
    finally { for (const node of nodes) ctx.closing.delete(node); }
    return selected;
  }
