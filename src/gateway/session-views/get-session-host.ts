import type { SessionHost } from "../../sessions/host/host-types.ts";
import type { HostContext } from "../host/host-state.ts";
import { assembleSessionHost } from "../session-hosts/assemble-session-host.ts";

export function sessionHost(ctx: HostContext, sessionId: string): SessionHost {
  ctx.methods.storedSession(sessionId);
  const cached = ctx.sessionHosts.hosts.get(sessionId);
  if (cached) { ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(); return cached; }
  return assembleSessionHost(ctx, sessionId);
}
