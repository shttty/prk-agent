import { children } from "./list-owned-children.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function assertSettled(ctx: DerivationContext, sessionId: string): void {
    const outstanding = children(ctx, sessionId);
    if (outstanding.length) throw new Error(`Owned children must be destroyed, transferred or upgraded first: ${outstanding.map((child) => `${ctx.env.get(child.sessionId).manager.getSessionId()} (${child.phase})`).join(", ")}`);
  }
