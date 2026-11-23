import type { MemoryUsage } from "../memory-types.ts";
import type { LayerScope, LayerSpec } from "../layers/layer-types.ts";
import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";
import { countChars } from "./count-chars.ts";

export function usage(layer: LayerSpec, entries: string[], scope: LayerScope): MemoryUsage {
  const chars = countChars(entries.join(MEMORY_ENTRY_DELIMITER));
  return {
    target: layer.name,
    ...(layer.path.includes("{instance}") ? { instance: scope.instance } : {}),
    ...(layer.path.includes("{project}") && scope.project !== undefined ? { project: scope.project } : {}),
    chars, limit: layer.capacityCharacters, soft: layer.soft, overLimit: chars > layer.capacityCharacters,
  };
}
