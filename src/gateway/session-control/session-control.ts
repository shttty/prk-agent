import type { SessionControl } from "../../sessions/session-control/control-types.ts";
import type { HostContext } from "../host/host-state.ts";

export function sessionControl(ctx: HostContext): SessionControl {
  return { rootSessionId: ctx.control.value.rootSessionId, supervisors: { ...ctx.control.value.supervisors } };
}
