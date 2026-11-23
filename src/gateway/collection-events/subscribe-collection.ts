import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function subscribeSessions(ctx: HostContext, listener: Parameters<GatewaySessionHost["subscribeSessions"]>[0]): () => void {
      ctx.events.listeners.add(listener);
      return () => { ctx.events.listeners.delete(listener); };
    }
