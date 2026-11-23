import { canControl } from "../../sessions/session-control/can-control.ts";
import { readDerivedSession } from "../../sessions/derivation/read-derived-session.ts";
import type { HostContext } from "../host/host-state.ts";

export function canControlSession(ctx: HostContext, actor: string, target: string): boolean {
  const acting = ctx.methods.storedSession(actor);
  const selected = ctx.methods.storedSession(target);
  const ownerChain: string[] = [];
  const visited = new Set([selected.sessionId]);
  let owner = readDerivedSession(selected.manager, ctx.derivation.derivationSchemas)?.owner;
  while (owner) {
    const ancestor = ctx.methods.stored(owner);
    if (ancestor.archived || visited.has(ancestor.sessionId)) break;
    ownerChain.push(ancestor.sessionId);
    visited.add(ancestor.sessionId);
    owner = readDerivedSession(ancestor.manager, ctx.derivation.derivationSchemas)?.owner;
  }
  return canControl({ sessionId: acting.sessionId, projectId: acting.projectId, ...ctx.methods.sessionRoles(acting.sessionId) }, {
    projectId: selected.projectId, ownerChain,
  });
}
