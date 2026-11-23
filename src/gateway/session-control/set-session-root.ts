import type { SessionControl } from "../../sessions/session-control/control-types.ts";
import { writeSessionControl } from "../../sessions/session-control/write-session-control.ts";
import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";

export function setSessionRoot(ctx: HostContext, { sessionId }: { readonly sessionId: string }): SessionControl {
  const entry = ctx.methods.storedSession(sessionId);
  if (!ctx.instances.targets.some((target) => target.id === entry.target && target.local === true)) {
    throw new WireError("INVALID_REQUEST", "Root must be a local, non-archived session.");
  }
  const value = { ...ctx.control.value, rootSessionId: entry.sessionId };
  writeSessionControl(ctx.control.path, value);
  ctx.control.value = value;
  ctx.methods.publish("session_control_changed", entry);
  return ctx.methods.sessionControl();
}
