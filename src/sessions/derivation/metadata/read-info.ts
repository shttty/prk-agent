import { readDerivedSession } from "../read-derived-session.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function info(ctx: DerivationContext, sessionId: string) {
  return readDerivedSession(ctx.env.get(sessionId).manager, ctx.schemas);
}
