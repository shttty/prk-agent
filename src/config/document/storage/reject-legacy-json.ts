import { lstat } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function rejectLegacyJsonConfig(home: string): Promise<void> {
  const resolvedHome = resolve(home);
  const found: string[] = [];
  for (const name of ["config.json", "instances.json"] as const) {
    try {
      await lstat(join(resolvedHome, name));
      found.push(name);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw new Error(`Unable to inspect ${name} in PRK home.`);
    }
  }
  if (found.length > 0) {
    throw new Error(`Legacy JSON configuration found in ${resolvedHome} (${found.join(", ")}). PRK reads only config.toml and instances.toml; run: node scripts/migrate-config-toml.mjs --home ${resolvedHome}`);
  }
}
