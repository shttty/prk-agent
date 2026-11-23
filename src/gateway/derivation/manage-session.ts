import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export async function manageSession(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["manageSession"]>[0], request: Parameters<GatewaySessionHost["manageSession"]>[1]): ReturnType<GatewaySessionHost["manageSession"]> {
      await ctx.methods.runtimeChange(() => ctx.derivation.derivation.manage(sessionId, request));
      return { ok: true };
    }
