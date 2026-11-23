import type { SessionManagementRequest } from "./derivation-types.ts";
import { requireInfo } from "./metadata/require-info.ts";
import { save } from "./metadata/save-state.ts";
import { change } from "./run-change.ts";
import { validateOwner } from "./ownership/validate-owner.ts";
import { changeOwner } from "./ownership/change-owner.ts";
import type { DerivationContext } from "./derivation-state.ts";

export async function manage(ctx: DerivationContext, sessionId: string, request: SessionManagementRequest): Promise<void> {
    sessionId = ctx.env.get(sessionId).sessionId;
    await change(ctx, sessionId, async () => {
      const state = requireInfo(ctx, sessionId);
      if (request.action === "upgrade") {
        const { pendingOwner: _, ...rest } = state;
        save(ctx, sessionId, { ...rest, lifecycle: "user", owner: null });
      } else if (request.action === "transfer") {
        const owner = ctx.env.get(request.owner).manager.getSessionId();
        validateOwner(ctx, sessionId, owner);
        await changeOwner(ctx, sessionId, state, owner);
      } else {
        throw new Error("Unknown session management action.");
      }
    });
  }
