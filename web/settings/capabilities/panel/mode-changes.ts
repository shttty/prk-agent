import type { CapabilityChange } from "../capability-types.ts";
import type { ModeItem, ToolModeName } from "./tool-mode.ts";
import { toolMode } from "./tool-mode.ts";

/** Writes that move an item from its current state to `mode` (enable id first, then the lazy id). */
export function modeChanges(item: ModeItem, mode: ToolModeName): CapabilityChange[] {
  const writes: CapabilityChange[] = [];
  const enabled = mode !== "off";
  if (enabled !== (toolMode(item) !== "off")) writes.push({ id: item.id, enabled });
  if (enabled && item.lazy?.id && (mode === "lazy") !== (item.lazy.enabled === true)) writes.push({ id: item.lazy.id, enabled: mode === "lazy" });
  return writes;
}
