import type { ModeItem, ToolModeName } from "./tool-mode.ts";
import { toolMode } from "./tool-mode.ts";

/** A group's own mode, or null when its catalogued members disagree (shown as 混合). */
export function groupMode(group: ModeItem, members: ModeItem[]): ToolModeName | null {
  if (group.enabled === false) return "off";
  const modes = new Set(members.filter((entry) => entry.catalogued && !entry.moduleOnly).map(toolMode));
  if (modes.size > 1) return null;
  return toolMode(group);
}
