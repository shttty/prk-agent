import type { ArchiveGroup } from "../../../src/gateway/wire/web-types.ts";
import type { UnreadableSession } from "../../workbench/payloads/payload-types.ts";
import type { UnreadableItem } from "../sidebar/sidebar-types.ts";
import { unreadableItem } from "../unreadable/unreadable-item.ts";

/** An archive group with the unreadable sessions archived in it; a group the Gateway does not list (only unreadable sessions) has no label. */
export type ArchiveGroupView = Omit<ArchiveGroup, "label"> & { unreadable: UnreadableItem[] };

/** Archive groups for the list: the Gateway's groups, each with the unreadable sessions archived in it; a group that holds only unreadable sessions is built from them. Only issues located in the archive belong here. */
export function archiveGroups(archive: readonly ArchiveGroup[], issues: readonly UnreadableSession[]): ArchiveGroupView[] {
  const groups: ArchiveGroupView[] = archive.map((group) => ({ ...group, unreadable: [] }));
  for (const issue of issues) {
    if (issue.location !== "archived" || !issue.archived) continue;
    const { group: name, at } = issue.archived;
    let group = groups.find((entry) => entry.group === name);
    if (!group) {
      group = { group: name, at, sessions: [], unreadable: [] };
      groups.push(group);
    }
    group.unreadable.push(unreadableItem(issue));
  }
  return groups;
}
