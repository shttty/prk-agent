import type { canControlSession } from "./can-control-session.ts";
import type { refreshSessionControl } from "./refresh-session-control.ts";
import type { sessionControl } from "./session-control.ts";
import type { sessionRoles } from "./session-roles.ts";
import type { setProjectSupervisor } from "./set-project-supervisor.ts";
import type { setSessionRoot } from "./set-session-root.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ControlMethods {
  canControlSession: WithoutContext<typeof canControlSession>;
  refreshSessionControl: WithoutContext<typeof refreshSessionControl>;
  sessionControl: WithoutContext<typeof sessionControl>;
  sessionRoles: WithoutContext<typeof sessionRoles>;
  setProjectSupervisor: WithoutContext<typeof setProjectSupervisor>;
  setSessionRoot: WithoutContext<typeof setSessionRoot>;
}
