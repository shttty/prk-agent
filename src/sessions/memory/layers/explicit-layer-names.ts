import type { MemoryStore } from "../memory-types.ts";

/** Layers written only on explicit instruction (standing rules); every write to them gets a visible notice. */
export function explicitLayerNames(store: MemoryStore): ReadonlySet<string> {
  try { return new Set(store.settings().layers.filter((layer) => layer.explicitOnly).map((layer) => layer.name)); }
  catch { return new Set(); }
}
