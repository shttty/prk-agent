import { info } from "../metadata/read-info.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function validateOwner(ctx: DerivationContext, sessionId: string, owner: string): void {
    if (info(ctx, sessionId)?.lifecycle === "user") throw new Error("A user-lifecycle session must remain top-level.");
    ctx.env.get(sessionId);
    let ancestor: string | null = ctx.env.get(owner).manager.getSessionId();
    const visited = new Set<string>();
    while (ancestor !== null) {
      if (ancestor === sessionId || visited.has(ancestor)) throw new Error("Ownership transfer would create a cycle.");
      visited.add(ancestor);
      ancestor = info(ctx, ancestor)?.owner ?? null;
    }
  }
