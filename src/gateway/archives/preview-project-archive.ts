import type { HostContext } from "../host/host-state.ts";
import type { ArchivePreviewSession, ProjectArchivePreview } from "./archive-types.ts";
import { readSessionDerivation } from "../session-views/readability/read-session-derivation.ts";

export function archiveProjectPreview(ctx: HostContext, projectId: string): ProjectArchivePreview {
  const sessions = new Map<string, ArchivePreviewSession>();
  const retained = new Map<string, ProjectArchivePreview["retained"][number]>();
  for (const entry of ctx.host.history.listAll().filter((entry) => entry.projectId === projectId)) {
    const preview = ctx.methods.archivePreview(entry.sessionId);
    for (const node of preview.sessions) {
      const owner = node.sessionId === entry.sessionId ? readSessionDerivation(ctx, entry)?.owner ?? null : node.owner;
      sessions.set(node.sessionId, { ...node, owner });
    }
    for (const node of preview.retained) retained.set(node.sessionId, node);
  }
  return {
    projectId,
    sessions: [...sessions.values()],
    retained: [...retained.values()].filter((node) => !sessions.has(node.sessionId)),
  };
}
