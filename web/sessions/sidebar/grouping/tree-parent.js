import { visibleOwner } from "./visible-owner.js";
import { viewGroupKey } from "./view-group-key.js";
/** The parent row a session nests under: its visible manager, but only within the same group, so views never pull a session out of its instance or project. */
export function treeParent(sessionRow, sessions, projectView) {
  const owner = visibleOwner(sessionRow, sessions);
  return owner && viewGroupKey(sessions.get(owner), projectView) === viewGroupKey(sessionRow, projectView) ? owner : "";
}
