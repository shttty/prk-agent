import { randomUUID } from "node:crypto";
import type { HostContext } from "../host/host-state.ts";
import type { ProjectAssignment, ProjectSelection } from "./project-types.ts";
import { WireError } from "../wire/create-error.ts";
import { validProjectSelection } from "../wire/validate-project-selection.ts";

export function resolveProject(ctx: HostContext, project: ProjectSelection | null): ProjectAssignment | null {
  if (project === null) return null;
  if (!validProjectSelection(project, ctx.host.config.limits, true)) throw new WireError("INVALID_REQUEST", "Invalid project selection.");
  const name = project.name.trim();
  // Archived membership participates in the same name uniqueness rule.
  const namesake = ctx.host.history.projectNamed(name);
  if (namesake !== undefined && namesake.id !== project.id) {
    throw new WireError("INVALID_REQUEST", `Project name ${JSON.stringify(namesake.name)} is already used by another project; choose that project instead.`);
  }
  return { id: project.id ?? `project-${randomUUID()}`, name };
}
