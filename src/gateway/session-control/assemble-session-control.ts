import type { HostContext } from "../host/host-state.ts";
import type { ControlMethods } from "./control-methods.ts";
import { canControlSession } from "./can-control-session.ts";
import { refreshSessionControl } from "./refresh-session-control.ts";
import { sessionControl } from "./session-control.ts";
import { sessionRoles } from "./session-roles.ts";
import { setProjectSupervisor } from "./set-project-supervisor.ts";
import { setSessionRoot } from "./set-session-root.ts";

export function assembleSessionControl(ctx: HostContext): ControlMethods {
  return {
    canControlSession: canControlSession.bind(undefined, ctx),
    refreshSessionControl: refreshSessionControl.bind(undefined, ctx),
    sessionControl: sessionControl.bind(undefined, ctx),
    sessionRoles: sessionRoles.bind(undefined, ctx),
    setProjectSupervisor: setProjectSupervisor.bind(undefined, ctx),
    setSessionRoot: setSessionRoot.bind(undefined, ctx),
  };
}
