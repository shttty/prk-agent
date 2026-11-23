import type { HostContext } from "../host/host-state.ts";

export function publishCapabilities(ctx: HostContext, sessionId: string): void {
    const entry = ctx.host.history.get(sessionId);
    if (!entry || entry.archived) return;
    ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true);
    ctx.methods.publish("session_capabilities_changed", entry, { requiresReload: ctx.host.collection.get(sessionId)?.requiresReload ?? false });
  }
