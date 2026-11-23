import { isAbsolute, join, resolve, basename } from "node:path";
import { readFileSync } from "node:fs";

export function convertPackages(packages, legacy, locations, sourceHome, sources = {}) {
  const result = [];
  const identities = new Map();
  const recovered = legacy.map((pkg) => {
    const source = sources[pkg.bundle];
    if (typeof source !== "string" || !source) throw new Error(`Legacy bundle ${pkg.bundle} has no proven original source; provide an explicit --sources mapping. Its name/version does not prove registry content.`);
    return { source, location: pkg.location };
  });
  for (const original of [...packages, ...recovered]) {
    const entry = typeof original === "string" ? { source: original } : { ...original };
    if (typeof entry.source !== "string" || !entry.source) throw new Error("Invalid package source in migration input.");
    const source = entry.source.startsWith("npm:") || entry.source.startsWith("git:") ? entry.source : isAbsolute(entry.source) ? entry.source : resolve(sourceHome, "agent", entry.source);
    let name = source.startsWith("npm:") ? source.slice(4).replace(/@[^@/]+$/u, "") : basename(source);
    if (isAbsolute(source)) {
      try { name = JSON.parse(readFileSync(join(source, "package.json"), "utf8")).name ?? name; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const previous = locations[entry.source] ?? locations[name] ?? entry.location;
    if (Array.isArray(previous)) throw new Error(`Package ${name} has multiple legacy locations; select one before migration.`);
    const location = previous === "target" || previous === "host" ? "host" : "gateway";
    const migrated = { ...entry, source, enabled: entry.enabled ?? true, location };
    if (identities.has(name)) {
      const existing = identities.get(name);
      if (existing.location !== migrated.location || existing.enabled !== migrated.enabled) throw new Error(`Conflicting package settings for ${name} across old lists.`);
      if (existing.source !== migrated.source) throw new Error(`Conflicting sources for ${name}.`);
      continue;
    }
    identities.set(name, migrated);
    result.push(migrated);
  }
  return result;
}
