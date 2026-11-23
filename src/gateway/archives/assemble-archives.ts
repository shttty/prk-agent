import { archiveGroups } from "./format-archive-groups.ts";
import { archiveSession } from "./archive-session.ts";
import { archivePreview } from "./preview-archive.ts";
import { unarchive } from "./unarchive-group.ts";
import { purgeArchive } from "./purge-group.ts";
import { archiveProjectPreview } from "./preview-project-archive.ts";
import { archiveProject } from "./archive-project.ts";
import type { HostContext } from "../host/host-state.ts";
import type { ArchivesMethods } from "./archives-methods.ts";

export function assembleArchives(ctx: HostContext): ArchivesMethods {
  return {
    archiveGroups: archiveGroups.bind(undefined, ctx),
    archiveSession: archiveSession.bind(undefined, ctx),
    archivePreview: archivePreview.bind(undefined, ctx),
    archiveProjectPreview: archiveProjectPreview.bind(undefined, ctx),
    archiveProject: archiveProject.bind(undefined, ctx),
    unarchive: unarchive.bind(undefined, ctx),
    purgeArchive: purgeArchive.bind(undefined, ctx),
  };
}
