import { children } from "../ownership/list-owned-children.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function visit(ctx: DerivationContext, current: string, seen: Set<string>, order: string[]): void {
      if (seen.has(current)) return;
      seen.add(current);
      for (const child of children(ctx, current)) visit(ctx, child.sessionId, seen, order);
      order.push(current);
    }
