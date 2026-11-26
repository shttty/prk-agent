import type { ProjectPayload, SessionGroup } from "../sidebar-types.ts";

/** Converts a sidebar project group into the PATCH /project payload (`null` ungroups, `undefined` cannot accept drops). */
export function projectPayloadForGroup(group: Pick<SessionGroup, "id" | "name">): ProjectPayload | null | undefined {
  if (group.id === "unreadable-unknown") return undefined;
  if (group.id === "project:ungrouped") return null;
  const id = group.id.trim();
  const name = group.name.trim();
  return id && name ? { id, name } : undefined;
}
