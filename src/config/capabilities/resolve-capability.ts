import type { CapabilitySwitches } from "./capability-types.ts";

export function resolveCapability(id: string, group: string | undefined, layers: readonly CapabilitySwitches[]): boolean {
  for (const layer of layers) {
    const enabled = layer[id] ?? (group === undefined ? undefined : layer[group]);
    if (enabled !== undefined) return enabled;
  }
  return true;
}
