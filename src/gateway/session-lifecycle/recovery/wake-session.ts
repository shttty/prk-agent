import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export async function wakeSession(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["wakeSession"]>[0]): ReturnType<GatewaySessionHost["wakeSession"]> {
   await ctx.lifecycle.transitions.get(sessionId);
   await ctx.methods.runtimeChange(() => ctx.methods.wake(sessionId));
   return { sessionId, sleeping: ctx.methods.storedSession(sessionId).sleeping === true };
    }
