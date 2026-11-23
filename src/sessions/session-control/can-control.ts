import type { ControlActor, ControlTarget } from "./control-types.ts";

export function canControl(actor: ControlActor, target: ControlTarget): boolean {
  return actor.root || target.ownerChain.includes(actor.sessionId)
    || (actor.supervisor && actor.projectId !== undefined && actor.projectId === target.projectId);
}
