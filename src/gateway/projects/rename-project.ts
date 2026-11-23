import type { HostContext } from "../host/host-state.ts";
import type { StoredSession } from "../../sessions/history/history-types.ts";
import { WireError } from "../wire/create-error.ts";
import { resolveProject } from "./resolve-project.ts";

export function renameProject(ctx: HostContext, projectId: string, name: string): { readonly ok: true } {
  const project = resolveProject(ctx, { id: projectId, name })!;
  const members = [...ctx.host.history.listAll(), ...ctx.host.history.listArchived()].filter((entry) => entry.projectId === projectId);
  if (!members.length) throw new WireError("NOT_FOUND", "Project not found.");
  ctx.host.memoryStore.renameProject(projectId, project.name);
  const archived = new Map<string, StoredSession>();
  try {
    for (const entry of members) {
      if (entry.projectName === project.name) continue;
      ctx.host.history.writeProject(entry.manager, project);
      if (entry.archived) archived.set(entry.archived.group, entry);
      else ctx.methods.publish("session_project_renamed", entry);
    }
  } finally {
    if (archived.size) for (const archiveGroup of ctx.methods.archiveGroups([])) {
      const entry = archived.get(archiveGroup.group);
      if (entry) ctx.methods.publish("archive_group_updated", entry, { archiveGroup });
    }
  }
  return { ok: true };
}
