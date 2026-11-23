import type { SessionControl } from "../../sessions/session-control/control-types.ts";
import { writeSessionControl } from "../../sessions/session-control/write-session-control.ts";
import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";

export function setProjectSupervisor(ctx: HostContext, { sessionId }: { readonly sessionId: string }, actor?: string): SessionControl {
  const entry = ctx.methods.storedSession(sessionId);
  if (actor !== undefined && !ctx.methods.sessionRoles(actor).root) {
    throw new WireError("INVALID_REQUEST", "Only root may designate a project supervisor; user API operations are unrestricted.");
  }
  if (entry.projectId === undefined) throw new WireError("INVALID_REQUEST", "A supervisor must belong to a project.");
  const value = { ...ctx.control.value, supervisors: { ...ctx.control.value.supervisors, [entry.projectId]: entry.sessionId } };
  writeSessionControl(ctx.control.path, value);
  ctx.control.value = value;
  ctx.methods.publish("session_control_changed", entry);
  return ctx.methods.sessionControl();
}
