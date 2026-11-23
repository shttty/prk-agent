import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function subscribeTerminal(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["subscribeTerminal"]>[0], terminal: Parameters<GatewaySessionHost["subscribeTerminal"]>[1], listener: Parameters<GatewaySessionHost["subscribeTerminal"]>[2]): ReturnType<GatewaySessionHost["subscribeTerminal"]> {
      ctx.methods.workspaceContext(sessionId);
      return ctx.workspace.terminals.subscribe(sessionId, terminal, listener);
    }
