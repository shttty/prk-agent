import { requireInfo } from "../metadata/require-info.ts";
import { change } from "../run-change.ts";
import { validateOwner } from "./validate-owner.ts";
import { changeOwner } from "./change-owner.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function acceptTransfer(ctx: DerivationContext, actor: string, child: string) {
    actor = ctx.env.get(actor).manager.getSessionId();
    child = ctx.env.get(child).sessionId;
    return change(ctx, child, async () => {
      const state = requireInfo(ctx, child);
      if (state.pendingOwner !== actor) throw new Error("No transfer to this session is pending.");
      validateOwner(ctx, child, actor);
      await changeOwner(ctx, child, state, actor);
      return { owner: actor };
    });
  }
