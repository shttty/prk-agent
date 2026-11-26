import type { SessionRow } from "../../session-row-types.ts";
import type { SidebarItem } from "../sidebar-types.ts";
import { MAX_TREE_DEPTH } from "../sidebar-constants.ts";
import { rowState, type RowState } from "../labels/row-state.ts";
import { statusPriority } from "./status-priority.ts";

/** The most urgent state among `children` and, through `childrenOf`, their descendants; undefined when none stands out. */
export function highestUnder(children: readonly SidebarItem[], childrenOf?: ReadonlyMap<string, SessionRow[]>, depth = 0, highest?: RowState): RowState | undefined {
  if (depth >= MAX_TREE_DEPTH) return highest;
  for (const child of children) {
    if (child.state === "unreadable") continue;
    const state = rowState(child);
    if (statusPriority(state.key) > statusPriority(highest?.key)) highest = state;
    if (highest?.key === "blocked") return highest;
    highest = highestUnder(childrenOf?.get(child.sessionId) ?? [], childrenOf, depth + 1, highest);
  }
  return highest;
}
