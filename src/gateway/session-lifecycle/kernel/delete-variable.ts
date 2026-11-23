import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function kernelDeleteVariable(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["kernelDeleteVariable"]>[0], variable: Parameters<GatewaySessionHost["kernelDeleteVariable"]>[1]): ReturnType<GatewaySessionHost["kernelDeleteVariable"]> {
      return ctx.methods.maintainSessionKernel(sessionId, { deleteVariable: variable });
    }
