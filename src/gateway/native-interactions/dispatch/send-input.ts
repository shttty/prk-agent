import type { HostContext } from "../../host/host-state.ts";
import type { ExtendedSendRequest } from "../../wire/wire-types.ts";

export async function nativeSend(ctx: HostContext, sessionId: string, request: ExtendedSendRequest): Promise<unknown> {
   return ctx.native.nativeInteractions.send(ctx.methods.nativeTarget(sessionId), request, async (deliver) => {
     await ctx.methods.ensureRuntime(sessionId);
     return ctx.methods.admitInput(sessionId, () => deliver(ctx.methods.nativeTarget(sessionId)));
   });
    }
