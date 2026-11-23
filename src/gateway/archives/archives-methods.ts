import type { archiveGroups } from "./format-archive-groups.ts";
import type { archiveSession } from "./archive-session.ts";
import type { archivePreview } from "./preview-archive.ts";
import type { unarchive } from "./unarchive-group.ts";
import type { purgeArchive } from "./purge-group.ts";
import type { archiveProjectPreview } from "./preview-project-archive.ts";
import type { archiveProject } from "./archive-project.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface ArchivesMethods {
  archiveGroups: WithoutContext<typeof archiveGroups>;
  archiveSession: WithoutContext<typeof archiveSession>;
  archivePreview: WithoutContext<typeof archivePreview>;
  archiveProjectPreview: WithoutContext<typeof archiveProjectPreview>;
  archiveProject: WithoutContext<typeof archiveProject>;
  unarchive: WithoutContext<typeof unarchive>;
  purgeArchive: WithoutContext<typeof purgeArchive>;
}
