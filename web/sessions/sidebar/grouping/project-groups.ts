import type { Groupable, SessionGroup } from "../sidebar-types.ts";
import { sessionProjectGroup } from "./session-project-group.ts";

export function projectGroups<Item extends Groupable>(items: readonly Item[]): SessionGroup<Item>[] {
  const groups = new Map<string, SessionGroup<Item>>();
  for (const sessionRow of items) {
    const id = sessionProjectGroup(sessionRow);
    const group = groups.get(id) ?? { id, name: sessionRow.projectName?.trim() || "未归类", sessions: [] };
    if (sessionRow.projectCreated) group.created = sessionRow.projectCreated;
    group.sessions.push(sessionRow);
    groups.set(id, group);
  }
  return [...groups.values()];
}
