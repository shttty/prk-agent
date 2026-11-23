import type { SessionRoles } from "../../sessions/session-control/control-types.ts";

export function sessionRoleMarkers({ root, supervisor }: Partial<SessionRoles>) {
  return {
    ...(root ? { root: true as const } : {}),
    ...(supervisor ? { supervisor: true as const } : {}),
  };
}
