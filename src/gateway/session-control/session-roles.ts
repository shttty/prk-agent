import type { SessionRoles } from "../../sessions/session-control/control-types.ts";
import type { HostContext } from "../host/host-state.ts";

export function sessionRoles(ctx: HostContext, sessionId: string): SessionRoles {
  const entry = ctx.methods.storedSession(sessionId);
  return {
    root: ctx.control.value.rootSessionId === entry.sessionId,
    supervisor: entry.projectId !== undefined && ctx.control.value.supervisors[entry.projectId] === entry.sessionId,
  };
}
