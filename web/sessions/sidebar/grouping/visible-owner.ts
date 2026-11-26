import type { SessionRows } from "../../../workbench/store/store-types.ts";
import type { SidebarItem } from "../sidebar-types.ts";

/** Current manager of a derived session, when that manager is visible. */
export function visibleOwner(sessionRow: SidebarItem, sessions: SessionRows): string {
  const owner = sessionRow.derivation?.owner?.trim();
  return owner && owner !== sessionRow.sessionId && sessions.has(owner) ? owner : "";
}
