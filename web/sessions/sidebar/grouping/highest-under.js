import { MAX_TREE_DEPTH } from "../sidebar-constants.js";
import { rowState } from "../labels/row-state.js";

const priority = { blocked: 5, stopped: 4, running: 3, compacting: 3, starting: 3, cancel_requested: 3, background: 2, done: 1 };
export const statusPriority = (state) => priority[state] ?? 0;

export function highestUnder(children, childrenOf, depth = 0, highest) {
  if (depth >= MAX_TREE_DEPTH) return highest;
  for (const child of children) {
    const state = rowState(child);
    if (statusPriority(state.key) > statusPriority(highest?.key)) highest = state;
    if (highest?.key === "blocked") return highest;
    highest = highestUnder(childrenOf?.get(child.sessionId) ?? [], childrenOf, depth + 1, highest);
  }
  return highest;
}
