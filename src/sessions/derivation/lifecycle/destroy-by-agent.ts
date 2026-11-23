import { change } from "../run-change.ts";
import { destroy } from "./destroy-owned-tree.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function destroyByAgent(ctx: DerivationContext, actor: string, child: string) {
    actor = ctx.env.get(actor).sessionId;
    child = ctx.env.get(child).sessionId;
    if (actor === child) throw new Error("Self-destruction is not allowed; submit your result to your owner.");
    return change(ctx, child, async () => {
      ctx.env.get(child);
      if (!ctx.env.canControl(actor, child)) throw new Error("Cannot destroy this session: control requires a parent or ancestor, root, or this project's supervisor.");
      const destroyed = await destroy(ctx, child);
      return { destroyed: true, sessions: destroyed.destroyed.map((node) => node.sessionId) };
    });
  }
