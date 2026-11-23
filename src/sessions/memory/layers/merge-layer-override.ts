/**
 * Applies a host override to the shared TOML document. Layers merge by name: listed fields replace the shared
 * layer's, `enabled = false` drops it, unknown names are appended as host-only layers; order stays the shared order.
 * `[review]` merges by field; other top-level keys replace.
 */
export function mergeLayerOverride(base: Readonly<Record<string, unknown>>, override: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (key === "layers") continue;
    merged[key] = key === "review" ? { ...tableOf("review", base.review), ...tableOf("override review", value) } : value;
  }
  if (override.layers === undefined) return merged;
  if (!Array.isArray(override.layers)) throw new Error("override layers must be a list.");
  const patches = new Map<string, Record<string, unknown>>();
  for (const [index, item] of override.layers.entries()) {
    const patch = tableOf(`override layers[${index}]`, item);
    if (typeof patch.name !== "string") throw new Error(`override layers[${index}].name is required.`);
    if (patches.has(patch.name)) throw new Error(`override layers lists ${patch.name} twice.`);
    patches.set(patch.name, patch);
  }
  const layers: Record<string, unknown>[] = [];
  for (const layer of (Array.isArray(base.layers) ? base.layers : []) as Record<string, unknown>[]) {
    const patch = patches.get(String(layer.name));
    patches.delete(String(layer.name));
    if (patch?.enabled === false) continue;
    layers.push({ ...layer, ...withoutEnabled(patch) });
  }
  for (const patch of patches.values()) if (patch.enabled !== false) layers.push(withoutEnabled(patch));
  merged.layers = layers;
  return merged;
}

function withoutEnabled(patch: Record<string, unknown> | undefined): Record<string, unknown> {
  if (patch === undefined) return {};
  if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") throw new Error(`override layer ${String(patch.name)}.enabled must be true or false.`);
  const { enabled: _enabled, ...fields } = patch;
  return fields;
}

function tableOf(name: string, value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be a table.`);
  return value as Record<string, unknown>;
}
