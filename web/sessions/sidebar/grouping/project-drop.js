import { text } from "../text.js";

/** Group key for a session row in the project view. */
export function sessionProjectGroup(sessionRow) {
  return text(sessionRow?.projectId).trim() || "project:ungrouped";
}

/** Converts a sidebar project group into the PATCH /project payload (`null` ungroups, `undefined` cannot accept drops). */
export function projectPayloadForGroup(group) {
  if (!group || group.id === "unreadable-unknown") return undefined;
  if (group.id === "project:ungrouped") return null;
  const id = text(group.id).trim();
  const name = text(group.name).trim();
  return id && name ? { id, name } : undefined;
}

export function canDropSessionToGroup(sessionRow, group) {
  if (!sessionRow || sessionRow.unreadable || !sessionRow.sessionId) return false;
  if (projectPayloadForGroup(group) === undefined) return false;
  return sessionProjectGroup(sessionRow) !== group.id;
}
