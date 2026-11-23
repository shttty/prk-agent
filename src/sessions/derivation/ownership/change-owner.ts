import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";
import { save } from "../metadata/save-state.ts";
import { deliverResult } from "../results/deliver-result.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function changeOwner(ctx: DerivationContext, sessionId: string, state: DerivedSessionInfo, owner: string): Promise<void> {
    const { pendingOwner: _, ...rest } = state;
    const next = { ...rest, owner };
    save(ctx, sessionId, next);
    await deliverResult(ctx, sessionId, next);
  }
