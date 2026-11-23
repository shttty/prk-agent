import type { PluginPackage } from "./package-types.ts";

export function parsePluginPackages(value: unknown): PluginPackage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("packages must be an array.");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const label = `packages[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${label}: run the offline plugin migration before starting PRK.`);
    if (Object.keys(entry).some((key) => !["source", "enabled", "location", "autoload", "extensions", "skills", "prompts", "themes"].includes(key))) throw new Error(`${label}: unknown package field.`);
    if (typeof entry.source !== "string" || !entry.source.trim() || seen.has(entry.source)) throw new Error(`${label}: source must be nonempty and unique.`);
    if (typeof entry.enabled !== "boolean" || !["host", "gateway"].includes(entry.location)) throw new Error(`${label}: enabled and location are required; run the offline plugin migration.`);
    if (entry.autoload !== undefined && typeof entry.autoload !== "boolean") throw new Error(`${label}.autoload must be boolean.`);
    for (const key of ["extensions", "skills", "prompts", "themes"]) {
      if (entry[key] !== undefined && (!Array.isArray(entry[key]) || !entry[key].every((item: unknown) => typeof item === "string"))) throw new Error(`${label}.${key} must be a string array.`);
    }
    seen.add(entry.source);
    return { ...entry } as PluginPackage;
  });
}
