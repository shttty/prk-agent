import type { ToolExposure } from "@earendil-works/pi-coding-agent";
import { META_TOOL_NAMES } from "../../sessions/tool-declarations/meta-tool-names.ts";
import type { CapabilitySwitches, ToolLazy } from "./capability-types.ts";
import { capabilityId } from "./validate-capability-id.ts";
import { lazyState } from "./resolve-lazy-state.ts";
import { toolGroupLazyDefault } from "./resolve-tool-group-lazy-default.ts";

export function toolLazy(tool: { name: string; group: string; exposure?: ToolExposure; enabled: boolean }, layers: readonly CapabilitySwitches[]): ToolLazy | undefined {
  if (Object.hasOwn(META_TOOL_NAMES, tool.name)) return undefined;
  const group = `lazy:${tool.group}`;
  if (!group.startsWith("lazy:group:tools:") || !capabilityId(group)) return undefined;
  return lazyState(`lazy:tool:${tool.name}`, group,
    toolGroupLazyDefault(tool.group), tool.enabled && tool.exposure !== "model-only", layers);
}
