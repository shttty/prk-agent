import { text } from "../text.js";
export function projectGroups(items) {
  const groups = new Map();
  for (const sessionRow of items) {
    const id = text(sessionRow.projectId).trim() || "project:ungrouped";
    const name = text(sessionRow.projectName).trim() || "未归类";
    const group = groups.get(id) || { id, name, sessions: [] };
    if (sessionRow.projectCreated) group.created = sessionRow.projectCreated;
    group.sessions.push(sessionRow);
    groups.set(id, group);
  }
  return [...groups.values()];
}
