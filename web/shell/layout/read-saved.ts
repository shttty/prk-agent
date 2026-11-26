import { LAYOUT, layoutKey } from "./layout-constants.ts";
import { storage } from "./layout-storage.ts";
import type { LayoutValues } from "./layout-types.ts";

/** A saved value, or its default when nothing valid is saved (the stored text is JSON from this page's earlier runs). */
export function readSaved<K extends keyof LayoutValues>(name: K): LayoutValues[K] {
  const fallback = LAYOUT[name];
  try {
    const value = JSON.parse(storage()?.getItem(layoutKey(name)) ?? "null");
    return typeof value === typeof fallback && (typeof value !== "number" || (Number.isFinite(value) && value > 0)) ? value : fallback;
  } catch { return fallback; }
}
