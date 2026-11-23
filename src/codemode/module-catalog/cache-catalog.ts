import { resolve } from "node:path";
import type { KernelHelper } from "./catalog-types.ts";
import { catalogs } from "./catalog-state.ts";

export function cacheKernelToolCatalog(home: string, instance: string, helpers: KernelHelper[]): void {
  const key = resolve(home);
  let instances = catalogs.get(key);
  if (!instances) catalogs.set(key, instances = new Map());
  instances.set(instance, helpers.map((helper) => ({ ...helper })));
}
