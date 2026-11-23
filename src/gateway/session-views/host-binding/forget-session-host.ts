import type { HostContext } from "../../host/host-state.ts";

export function forgetHost(ctx: HostContext, sessionId: string): void {
  ctx.sessionHosts.hostBindings.get(sessionId)?.dispose();
  ctx.sessionHosts.hostBindings.delete(sessionId);
  ctx.sessionHosts.hosts.delete(sessionId);
 }
