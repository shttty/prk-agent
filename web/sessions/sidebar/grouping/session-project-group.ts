import type { Groupable } from "../sidebar-types.ts";

/** Group key for a session row in the project view. */
export function sessionProjectGroup(sessionRow: Groupable | undefined): string {
  return sessionRow?.projectId?.trim() || "project:ungrouped";
}
