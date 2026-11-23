import { info } from "../metadata/read-info.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function children(ctx: DerivationContext, sessionId: string) {
    ctx.env.get(sessionId);
    return ctx.env.list().flatMap((entry) => {
      const state = info(ctx, entry.sessionId);
      return state?.owner === sessionId ? [{ sessionId: entry.sessionId, phase: state.phase }] : [];
    });
  }
