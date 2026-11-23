import type { CapabilitySwitches, ToolLazy } from "./capability-types.ts";
import { capabilityId } from "./validate-capability-id.ts";
import { lazyState } from "./resolve-lazy-state.ts";
import { toolGroupLazyDefault } from "./resolve-tool-group-lazy-default.ts";

export function toolGroupLazy(group: string, enabled: boolean, layers: readonly CapabilitySwitches[]): ToolLazy | undefined {
  const id = `lazy:${group}`;
  return group.startsWith("group:tools:") && capabilityId(id) ? lazyState(id, undefined, toolGroupLazyDefault(group), enabled, layers) : undefined;
}
