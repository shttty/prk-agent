import type { CapabilityGroup } from "../capability-types.ts";
import { modeChanges } from "./mode-changes.ts";
import type { ToolModeName } from "./tool-mode.ts";

/** Group line: built-in and plugin groups expose `group.lazy` from the catalog; groups without it fall back to off/on. */
export function groupItem(group: CapabilityGroup) {
  return { item: group, writes: (mode: ToolModeName) => modeChanges(group, mode) };
}
