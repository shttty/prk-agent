import type { FileEdit, MemoryStoreContext } from "../memory-types.ts";
import { readStoreSettings } from "../layers/read-store-settings.ts";
import { resolveLayerPath } from "../layers/resolve-layer-path.ts";
import { readRaw } from "./read-document.ts";
import { commit } from "../batches/commit-files.ts";

/** Removes this instance's file from every instance-scoped layer in one batch. */
export function deleteInstance(ctx: MemoryStoreContext, instance: string): void {
  const edits = new Map<string, FileEdit>();
  for (const layer of readStoreSettings(ctx).layers) {
    if (!layer.path.includes("{instance}") || layer.path.includes("{project}")) continue;
    const path = resolveLayerPath(layer, { instance })!;
    const before = readRaw(path);
    if (before !== undefined) edits.set(path, { before, after: undefined });
  }
  commit(edits);
}
