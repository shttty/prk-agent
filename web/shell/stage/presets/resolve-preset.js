import { readPresets } from "../../layout/layout-store.js";
import { BUILTIN_PRESETS } from "./builtin-presets.js";
import { parsePresets } from "./parse-presets.js";

/** The layout a preset id names ("builtin:<n>" | "saved:<name>"); built-in layout 1 for one that no longer exists. */
export function resolvePreset(id) {
  const builtin = BUILTIN_PRESETS.find((preset) => preset.id === id);
  if (builtin) return builtin.layout;
  return parsePresets(readPresets()).find((entry) => `saved:${entry.name}` === id)?.layout ?? BUILTIN_PRESETS[0].layout;
}
