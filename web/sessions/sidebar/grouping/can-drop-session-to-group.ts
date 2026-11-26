import type { SessionGroup, SidebarItem } from "../sidebar-types.ts";
import { projectPayloadForGroup } from "./project-payload-for-group.ts";
import { sessionProjectGroup } from "./session-project-group.ts";

export function canDropSessionToGroup(sessionRow: SidebarItem | null, group: Pick<SessionGroup, "id" | "name">): boolean {
  if (!sessionRow || sessionRow.state === "unreadable" || !sessionRow.sessionId) return false;
  if (projectPayloadForGroup(group) === undefined) return false;
  return sessionProjectGroup(sessionRow) !== group.id;
}
