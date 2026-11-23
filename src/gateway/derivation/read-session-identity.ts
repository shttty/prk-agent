import type { HostContext } from "../host/host-state.ts";
import { readDerivedSession } from "../../sessions/derivation/read-derived-session.ts";
import type { SessionIdentity } from "../../plugins/sessions/session-types.ts";

export function readSessionIdentity(ctx: HostContext, sessionId: string): SessionIdentity | undefined {
  let current = ctx.methods.storedSession(sessionId);
  const identity = readDerivedSession(current.manager, ctx.derivation.derivationSchemas);
  const cwd = current.cwd;
  let depth = 0;
  let parentLabel = "";
  for (let state = readDerivedSession(current.manager, ctx.derivation.derivationSchemas); state?.owner; state = readDerivedSession(current.manager, ctx.derivation.derivationSchemas)) {
    current = ctx.methods.storedSession(state.owner);
    if (depth === 0) parentLabel = current.label || current.sessionId;
    depth++;
  }
  return depth ? { depth, parentLabel, ...(identity?.isolated ? { isolated: true, cwd, repoRoot: identity.repoRoot } : {}) } : undefined;
}
