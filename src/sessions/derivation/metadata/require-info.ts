import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";
import { info } from "./read-info.ts";
import type { DerivationContext } from "../derivation-state.ts";

export function requireInfo(ctx: DerivationContext, sessionId: string): DerivedSessionInfo {
    const value = info(ctx, sessionId);
    if (!value) throw new Error("This is not a derived session.");
    return value;
  }
