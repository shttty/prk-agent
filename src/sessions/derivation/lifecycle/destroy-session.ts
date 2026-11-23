import { change } from "../run-change.ts";
import { destroy } from "./destroy-owned-tree.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function destroySession(ctx: DerivationContext, sessionId: string) {
  sessionId = ctx.env.get(sessionId).sessionId;
  return change(ctx, sessionId, () => destroy(ctx, sessionId));
}
