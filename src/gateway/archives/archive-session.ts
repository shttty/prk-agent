import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { WireError } from "../wire/create-error.ts";

export async function archiveSession(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["archiveSession"]>[0], request: Parameters<GatewaySessionHost["archiveSession"]>[1]): ReturnType<GatewaySessionHost["archiveSession"]> {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
      if (request?.confirm !== true) throw new WireError("INVALID_REQUEST", "Archiving a session requires explicit confirmation.");
      ctx.methods.storedSession(sessionId);
      const live = ctx.host.collection.snapshot().find((session) => session.sessionId === sessionId)?.state;
      if (live === "starting" || live === "closing" || ctx.lifecycle.transitions.has(sessionId)) {
        throw new WireError("BUSY", "Session is still starting, closing or changing sleep state; nothing was archived.");
      }
      await ctx.methods.runtimeChange(() => ctx.derivation.derivation.destroySession(sessionId));
    }
