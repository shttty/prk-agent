import { randomUUID } from "node:crypto";
import type { HostContext } from "../host/host-state.ts";
import { WireError } from "../wire/create-error.ts";

export function manageProject(ctx: HostContext, actor: string, session: string, projectName: string | null): { session: string; project: { id: string; name?: string } | null } {
  if (!ctx.methods.canControlSession(actor, session)) {
    throw new WireError("INVALID_REQUEST", "Project assignment requires an owner-chain ancestor, root, or the target project's supervisor.");
  }
  let project: { id: string; name: string } | null = null;
  if (projectName !== null) {
    const wanted = projectName.trim();
    if (!wanted) throw new WireError("INVALID_REQUEST", "Project name cannot be empty; use null for ungrouped.");
    project = ctx.host.history.projectNamed(wanted) ?? { id: `project-${randomUUID()}`, name: wanted };
  }
  const selected = ctx.methods.storedSession(session);
  ctx.methods.assignProject(selected.sessionId, project);
  const updated = ctx.methods.storedSession(selected.sessionId);
  return { session: updated.sessionId, project: updated.projectId === undefined ? null : { id: updated.projectId, name: updated.projectName } };
}
