import type { SessionRows } from "../../session-row-types.ts";
import type { SidebarItem } from "../sidebar-types.ts";
import { visibleOwner } from "./visible-owner.ts";
import { viewGroupKey } from "./view-group-key.ts";

/** The parent row a session nests under: its visible manager, but only within the same group, so views never pull a session out of its instance or project. */
export function treeParent(sessionRow: SidebarItem, sessions: SessionRows, projectView: boolean): string {
  const owner = visibleOwner(sessionRow, sessions);
  return owner && viewGroupKey(sessions.get(owner), projectView) === viewGroupKey(sessionRow, projectView) ? owner : "";
}
