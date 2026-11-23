import type { MemoryDocument } from "../memory-types.ts";
import type { LayerScope, LayerSpec } from "../layers/layer-types.ts";
import { resolveLayerPath } from "../layers/resolve-layer-path.ts";
import { entries as parseEntries } from "./parse-entries.ts";
import { readRaw } from "./read-document.ts";
import { usage } from "../capacity/measure-usage.ts";

export function document(layer: LayerSpec, scope: LayerScope, extra: { deleted?: boolean; projectName?: string } = {}): MemoryDocument {
  const entries = parseEntries(readRaw(resolveLayerPath(layer, scope)!));
  return { ...usage(layer, entries, scope), entries, ...extra };
}
