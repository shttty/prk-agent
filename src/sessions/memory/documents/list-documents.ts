import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { MemoryDocument, MemoryLayerInfo, MemoryListing, MemoryStoreContext } from "../memory-types.ts";
import type { LayerSpec } from "../layers/layer-types.ts";
import { readStoreSettings } from "../layers/read-store-settings.ts";
import { document } from "./document.ts";

/**
 * Every layer's documents for the settings page: unscoped layers once, instance layers per configured target plus
 * retained files (deleted = no longer configured), project layers per registered project.
 */
export function list(ctx: MemoryStoreContext, instances: readonly string[]): MemoryListing {
  let settings;
  try { settings = readStoreSettings(ctx); }
  catch (error) { return { enabled: false, error: error instanceof Error ? error.message : String(error), layers: [], memories: [] }; }
  const projects = registeredProjects(settings.projectsDirectory);
  const memories: MemoryDocument[] = [];
  for (const layer of settings.layers) {
    const scope = scopeOf(layer);
    if (scope === "none") memories.push(document(layer, { instance: "" }));
    else if (scope === "instance") {
      const configured = new Set(instances);
      for (const instance of [...new Set([...instances, ...retainedInstances(layer)])].sort()) {
        memories.push(document(layer, { instance }, configured.has(instance) ? {} : { deleted: true }));
      }
    } else for (const project of projects) memories.push(document(layer, { instance: "", project: project.id }, { projectName: project.name }));
  }
  const layers: MemoryLayerInfo[] = settings.layers.map((layer) => ({
    name: layer.name, description: layer.description, capacityCharacters: layer.capacityCharacters,
    soft: layer.soft, explicitOnly: layer.explicitOnly, review: layer.review, scope: scopeOf(layer),
  }));
  return { enabled: ctx.enabled, layers, memories };
}

function scopeOf(layer: LayerSpec): MemoryLayerInfo["scope"] {
  return layer.path.includes("{project}") ? "project" : layer.path.includes("{instance}") ? "instance" : "none";
}

// Files matching the layer's `<dir>/<prefix>{instance}<suffix>` template; other template shapes list configured targets only.
function retainedInstances(layer: LayerSpec): string[] {
  const name = basename(layer.path);
  if (dirname(layer.path).includes("{") || !name.includes("{instance}")) return [];
  const [prefix, suffix] = name.split("{instance}") as [string, string];
  try {
    return readdirSync(dirname(layer.path), { withFileTypes: true })
      .filter((file) => file.isFile() && file.name.startsWith(prefix) && file.name.endsWith(suffix) && file.name.length > prefix.length + suffix.length)
      .map((file) => file.name.slice(prefix.length, file.name.length - suffix.length))
      .filter((instance) => instance.trim() !== "" && instance !== "." && instance !== ".." && !/\p{Cc}/u.test(instance));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function registeredProjects(directory: string): { id: string; name: string }[] {
  let names: string[];
  try { names = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  return names.flatMap((id) => {
    try {
      const record = JSON.parse(readFileSync(join(directory, id, "project.json"), "utf8")) as { id?: unknown; name?: unknown };
      return record.id === id && typeof record.name === "string" ? [{ id, name: record.name }] : [];
    } catch { return []; }
  }).sort((left, right) => left.name.localeCompare(right.name));
}
