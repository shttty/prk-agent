import type { SidebarItem } from "../sidebar-types.ts";
import { itemIdentity } from "./item-identity.ts";
import { sessionProjectGroup } from "./session-project-group.ts";

/** Sidebar grouping follows the selected instance or project view. */
export function viewGroupKey(sessionRow: SidebarItem | undefined, projectView: boolean): string {
  if (projectView) return sessionProjectGroup(sessionRow);
  return `target:${sessionRow?.target.trim() || (sessionRow ? itemIdentity(sessionRow) : "")}`;
}
