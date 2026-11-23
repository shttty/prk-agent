import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function monitorFocus(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["monitorFocus"]>[0], open: Parameters<GatewaySessionHost["monitorFocus"]>[1]): { readonly focused: boolean; readonly leaseMs: number } {
      ctx.monitoring.monitor.focus(ctx.methods.storedSession(sessionId).sessionId, open);
      return { focused: open, leaseMs: ctx.host.config.monitor.focusLeaseMs };
    }
