import { readPresets } from "../../layout/read-presets.ts";
import { BUILTIN_PRESETS } from "./builtin-presets.ts";
import { parsePresets } from "./parse-presets.ts";

/** The layout a preset id names ("builtin:<n>" | "saved:<name>"); built-in layout 1 for one that no longer exists. */
export function resolvePreset(id: string) {
  const builtin = BUILTIN_PRESETS.find((preset) => preset.id === id);
  if (builtin) return builtin.layout;
  return parsePresets(readPresets()).find((entry) => `saved:${entry.name}` === id)?.layout ?? BUILTIN_PRESETS[0].layout;
}
