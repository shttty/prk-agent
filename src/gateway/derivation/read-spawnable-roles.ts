import type { HostContext } from "../host/host-state.ts";
import type { SpawnableRole } from "../../plugins/sessions/session-types.ts";
import { readDerivedSession } from "../../sessions/derivation/read-derived-session.ts";

/** Roles the session may spawn, by name: its own role's `spawns`, or every configured role for a top-level or unrestricted session. */
export function readSpawnableRoles(ctx: HostContext, sessionId: string): SpawnableRole[] {
  const roles = ctx.derivation.derivationConfig.roles ?? {};
  const callerRole = readDerivedSession(ctx.methods.storedSession(sessionId).manager, ctx.derivation.derivationSchemas)?.role;
  const allowed = callerRole === undefined ? undefined : roles[callerRole]?.spawns;
  return Object.entries(roles)
    .filter(([name]) => allowed === undefined || allowed.includes(name))
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, { description }]) => ({ name, ...(description === undefined ? {} : { description }) }));
}
