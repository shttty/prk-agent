import type { HostContext } from "../host/host-state.ts";
import type { ProjectAssignment } from "./project-types.ts";

export function rememberProject(ctx: HostContext, project: ProjectAssignment, created?: string): void {
  if (ctx.host.projectDates.has(project.id)) return;
  const date = ctx.host.memoryStore.registerProject(project.id, project.name, created ?? new Date().toISOString());
  ctx.host.projectDates.set(project.id, date);
}
