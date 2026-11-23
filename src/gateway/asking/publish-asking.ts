import type { HostContext } from "../host/host-state.ts";

export function announceAsk(ctx: HostContext, sessionId: string, asking: boolean): void {
    const entry = ctx.host.history.get(sessionId);
    if (entry && !entry.archived) ctx.methods.publish("session_ask", entry, { asking });
  }
