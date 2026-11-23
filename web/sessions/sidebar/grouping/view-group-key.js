import { text } from "../text.js";
/** Sidebar grouping follows the selected instance or project view. */
export function viewGroupKey(sessionRow, projectView) {
  if (projectView) return text(sessionRow?.projectId).trim() || "project:ungrouped";
  return `target:${text(sessionRow?.target).trim() || (sessionRow?.sessionId || sessionRow?.key)}`;
}
