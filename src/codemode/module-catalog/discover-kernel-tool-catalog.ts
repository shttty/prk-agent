import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KernelHelper } from "./catalog-types.ts";
import { kernelToolCatalog } from "./read-kernel-tool-catalog.ts";
import { scan } from "../module-payload/scan-kernel-modules.ts";

/** Discover names/source without importing Python; function metadata waits for kernel inspect. */
export async function discoverKernelToolCatalog(home: string, instance?: string, builtinDirectory = fileURLToPath(new URL("../../kernel-tools/", import.meta.url))): Promise<KernelHelper[]> {
  const modules = await scan(builtinDirectory);
  for (const [name, entry] of await scan(join(home, "kernel-tools"))) modules.set(name, { ...entry, overridesBuiltin: modules.has(name) });
  const helpers = kernelToolCatalog(home, instance);
  const inspected = new Set(helpers.map((helper) => helper.module));
  for (const module of modules.values()) if (!inspected.has(module.name)) helpers.push({
    name: `module:${module.name}`, signature: "", description: module.error ? "Module unavailable" : "Awaiting kernel inspection",
    module: module.name, source: module.path, overridesBuiltin: module.overridesBuiltin,
    dependencies: module.dependencies, moduleOnly: true, pending: !module.error, available: false,
    ...(module.error ? { error: module.error } : {}),
  });
  return helpers;
}
