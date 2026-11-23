import { unreadableItem } from "../unreadable/unreadable-item.js";
/** Archive groups for the list: the Gateway's groups, each with the unreadable sessions archived in it; a group that holds only unreadable sessions is built from them. Only issues located in the archive belong here. */
export function archiveGroups(archive, issues) {
  const groups = archive.map((group) => ({ ...group, unreadable: [] }));
  for (const issue of issues) {
    if (issue.location !== "archived") continue;
    let group = groups.find((entry) => entry.group === issue.archived.group);
    if (!group) {
      group = { group: issue.archived.group, at: issue.archived.at, sessions: [], unreadable: [] };
      groups.push(group);
    }
    group.unreadable.push(unreadableItem(issue));
  }
  return groups;
}
