import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import type { ModulePayload, ModuleSource } from "./module-types.ts";
import { entries } from "./read-module-entries.ts";
import { dependencies } from "./parse-dependencies.ts";
import { collect } from "./collect-package-sources.ts";

export async function scan(directory: string): Promise<Map<string, ModulePayload>> {
  const modules = new Map<string, ModulePayload>();
  for (const item of (await entries(directory)).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = item.isDirectory() ? item.name : item.isFile() && item.name.endsWith(".py") ? item.name.slice(0, -3) : "";
    if (!/^[A-Za-z]\w*$/u.test(name)) continue;
    const root = join(directory, item.name);
    const path = item.isDirectory() ? join(root, "__init__.py") : root;
    const sources: Record<string, ModuleSource> = {};
    const module: ModulePayload = { name, path, sources, dependencies: {}, overridesBuiltin: false };
    try {
      if (item.isDirectory() && !(await entries(root)).some((entry) => entry.name === "__init__.py" && entry.isFile())) continue;
      const manifest = item.isDirectory() ? join(root, "prk-tool.toml") : join(directory, `${name}.prk-tool.toml`);
      const legacy = manifest.replace(/\.toml$/u, ".json");
      let legacyExists = false;
      try { await lstat(legacy); legacyExists = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (legacyExists) throw new Error(`Legacy kernel tool manifest ${legacy} is not supported; rename it to ${manifest}.`);
      await collect(sources, path, `prk_tools.${name}`, item.isDirectory());
      let text: string | undefined;
      try { text = await readFile(manifest, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (text !== undefined) {
        const value = parse(text);
        if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => key !== "dependencies")) throw new Error("prk-tool.toml supports only dependencies");
        module.dependencies = dependencies(value.dependencies);
      }
    } catch (error) {
      module.error = error instanceof Error ? error.message : String(error);
      sources[`prk_tools.${name}`] ??= { source: "", path, package: item.isDirectory() };
    }
    modules.set(name, module);
  }
  return modules;
}
