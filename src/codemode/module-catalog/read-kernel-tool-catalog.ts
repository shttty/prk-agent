import { resolve } from "node:path";
import type { KernelHelper } from "./catalog-types.ts";
import { catalogs } from "./catalog-state.ts";
import { STATIC_KERNEL_HELPERS } from "./cold-catalog.ts";

export function kernelToolCatalog(home: string, instance?: string): KernelHelper[] {
  const instances = catalogs.get(resolve(home));
  const cached = instance === undefined ? instances && [...instances.values()].flat() : instances?.get(instance);
  if (!cached) return STATIC_KERNEL_HELPERS.map((helper) => ({ ...helper }));
  if (instance !== undefined) return cached.map((helper) => ({ ...helper }));
  const union = new Map<string, KernelHelper>();
  for (const helper of cached) {
    const previous = union.get(helper.name);
    if (!previous || helper.available !== false || previous.available === false) union.set(helper.name, helper);
  }
  const availableModules = new Set([...union.values()].filter((helper) => helper.available !== false).map((helper) => helper.module));
  return [...union.values()].filter((helper) => !helper.error || !availableModules.has(helper.module)).map((helper) => ({ ...helper }));
}
