import { MAX_TREE_DEPTH } from "../sidebar-constants.js";
/** A session below `name` (any shown depth) has an ask waiting. */
export function askingUnder(name, childrenOf, depth = 0) {
  return depth < MAX_TREE_DEPTH && (childrenOf.get(name) || []).some((child) => child.asking === true || askingUnder(child.sessionId, childrenOf, depth + 1));
}
