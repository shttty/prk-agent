import type { CapabilitySwitches, ToolLazy } from "./capability-types.ts";

export function lazyState(id: string, group: string | undefined, fallback: boolean, available: boolean, layers: readonly CapabilitySwitches[]): ToolLazy {
  let enabled = fallback;
  let defaultEnabled = fallback;
  let overridden = false;
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index]!;
    const value = layer[id] ?? (group === undefined ? undefined : layer[group]);
    if (index === 0) {
      defaultEnabled = enabled;
      overridden = layer[id] !== undefined;
    }
    if (value !== undefined) enabled = value;
  }
  return { id, enabled, defaultEnabled, overridden, available };
}
