import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function history(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["history"]>[0]): ReturnType<GatewaySessionHost["history"]> {
      const entry = ctx.methods.stored(sessionId);
      return Object.freeze({
        readOnly: true,
        session: ctx.methods.managedSessionSnapshot(entry),
        snapshot: ctx.methods.archivedSnapshot(entry),
      });
    }
