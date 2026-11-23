import type { HostContext } from "../host/host-state.ts";
import type { ProjectArchiveResult } from "./archive-types.ts";
import { WireError } from "../wire/create-error.ts";

export async function archiveProject(ctx: HostContext, projectId: string, request: { readonly confirm: true }): Promise<ProjectArchiveResult> {
  if (request?.confirm !== true) throw new WireError("INVALID_REQUEST", "Archiving a project requires explicit confirmation.");
  const preview = ctx.methods.archiveProjectPreview(projectId);
  const members = ctx.host.history.listAll().filter((entry) => entry.projectId === projectId);
  // Archive a parent through the existing cascade, not each child independently.
  const owned = new Set(members.flatMap((entry) => ctx.methods.archivePreview(entry.sessionId).sessions
    .filter((node) => node.sessionId !== entry.sessionId).map((node) => node.sessionId)));
  let failure: ProjectArchiveResult["error"];
  for (const entry of members.filter((entry) => !owned.has(entry.sessionId))) {
    try { await ctx.methods.archiveSession(entry.sessionId, request); }
    catch (error) {
      failure = { code: error instanceof WireError ? error.code : "HOST_ERROR", message: error instanceof Error ? error.message : String(error) };
      break;
    }
  }
  const archived = new Set(ctx.host.history.listArchived().map((entry) => entry.sessionId));
  return {
    projectId,
    archived: preview.sessions.filter((node) => archived.has(node.sessionId)),
    unarchived: preview.sessions.filter((node) => !archived.has(node.sessionId)),
    ...(failure ? { error: failure } : {}),
  };
}
