import { useMemo, useState } from "react";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow, SessionRows } from "../../workbench/store/store-types.ts";
import type { UnreadableSession } from "../../workbench/payloads/payload-types.ts";
import { closedLast } from "./grouping/closed-last.ts";
import { instanceGroups } from "./grouping/instance-groups.ts";
import { projectGroups } from "./grouping/project-groups.ts";
import { targetMap } from "./grouping/target-map.ts";
import { treeParent } from "./grouping/tree-parent.ts";
import { unknownLocationGroup } from "../unreadable/unknown-location-group.ts";
import { unreadableItem } from "../unreadable/unreadable-item.ts";
import { MAX_TREE_DEPTH } from "./sidebar-constants.ts";
import type { SessionGroup, SidebarItem, TreeState } from "./sidebar-types.ts";

/** The sidebar's rows arranged for the current view: instance or project groups, derived sessions nested under their manager. */
export function useSidebarGroups(sessions: SessionRows, targetList: PublicExecutionTarget[], unreadableSessions: UnreadableSession[], projectView: boolean) {
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(() => new Set());
  // Derived sessions hang under their current manager (the relation deletion cascades along) when both sit in the same
  // group of the current view; expanded by default.
  const tree = useMemo<TreeState>(() => {
    const childrenOf = new Map<string, SessionRow[]>();
    for (const sessionRow of [...sessions.values()].reverse()) {
      const owner = treeParent(sessionRow, sessions, projectView);
      if (owner) childrenOf.set(owner, [...(childrenOf.get(owner) || []), sessionRow]);
    }
    const toggle = (sessionId: string) => setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
    return { childrenOf, collapsed: collapsedNodes, toggle };
  }, [sessions, collapsedNodes, projectView]);
  const roots = (list: SidebarItem[]) => list.filter((sessionRow) => !treeParent(sessionRow, sessions, projectView));
  const treeSize = (list: SidebarItem[], depth = 0): number => depth > MAX_TREE_DEPTH ? 0 : list.reduce((sum, sessionRow) => sum + 1 + treeSize(tree.childrenOf.get(sessionRow.sessionId) || [], depth + 1), 0);
  const targets = useMemo(() => targetMap(targetList), [targetList]);
  // Unreadable active sessions take rows in their own instance/project group; archived ones live in the archive list;
  // those whose location is unknown get their own group instead of a guessed one.
  const unreadableRows = useMemo(() => unreadableSessions.filter((issue) => issue.location === "active").map(unreadableItem), [unreadableSessions]);
  const unknownRows = useMemo(() => unreadableSessions.filter((issue) => issue.location === "unknown").map(unreadableItem), [unreadableSessions]);
  const groups = useMemo<SessionGroup[]>(() => {
    const items: SidebarItem[] = [...[...sessions.values()].reverse(), ...unreadableRows];
    const placed = projectView ? projectGroups(items) : instanceGroups(items, targetList);
    // Ungrouped rows sit above project headings in this view only; archive grouping is unchanged.
    if (projectView) placed.sort((a, b) => Number(b.id === "project:ungrouped") - Number(a.id === "project:ungrouped"));
    return unknownRows.length ? [...placed, unknownLocationGroup(unknownRows)] : placed;
  }, [targetList, sessions, unreadableRows, unknownRows, projectView]);
  const sessionCount = [...sessions.values()].filter((sessionRow) => sessionRow.sessionId).length + unreadableRows.length + unknownRows.length;
  const ungroupedPresent = projectView && groups.some((group) => group.id === "project:ungrouped" && closedLast(roots(group.sessions)).length > 0);
  return { tree, targets, groups, roots, treeSize, sessionCount, ungroupedPresent };
}
