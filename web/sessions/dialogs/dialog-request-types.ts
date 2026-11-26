import type { ProjectPayload } from "../sidebar/sidebar-types.ts";

/** What the shell asks the session dialog to show: `targetName` is the session (or instance, for create) it is about. */
export type DialogRequest =
  | { type: "create"; targetName?: string; project?: ProjectPayload }
  | { type: "project" | "rename" | "derivation" | "archive" | "retarget" | "root" | "supervisor"; targetName?: string }
  | { type: "rename-project" | "archive-project" | "project-memory"; targetName?: string; project: ProjectPayload };
