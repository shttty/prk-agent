import type { SavedPreset } from "./preset-types.ts";
import { BUILTIN_PRESETS } from "./builtin-presets.ts";

/** Why `name` cannot name a new saved layout ("empty" | "taken"), or null. Built-in names count as taken. */
export function layoutNameProblem(name: string, saved: readonly SavedPreset[]) {
  const clean = name.trim();
  if (!clean) return "empty";
  return [...BUILTIN_PRESETS, ...saved].some((preset) => preset.name === clean) ? "taken" : null;
}
