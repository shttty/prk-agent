import { BUILTIN_PRESETS } from "./builtin-presets.js";

/** Why `name` cannot name a new saved layout ("empty" | "taken"), or null. Built-in names count as taken. */
export function layoutNameProblem(name, saved) {
  const clean = name.trim();
  if (!clean) return "empty";
  return [...BUILTIN_PRESETS, ...saved].some((preset) => preset.name === clean) ? "taken" : null;
}
