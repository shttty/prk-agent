import type { CapabilityCatalog, CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import type { CapabilityProjectionContext, CatalogCapabilityEntry, SkillDirectory } from "./catalog-types.ts";
import { LOCAL_TOOLS_GROUP } from "./catalog-constants.ts";
import { skillDirectoryGroup } from "./origins/identify-skill-directory-group.ts";
import { skillDirectoryLabel } from "./origins/format-skill-directory-label.ts";
import { value } from "./capabilities/value.ts";
import { defaultValue } from "./capabilities/default-value.ts";
import { overridden } from "./capabilities/overridden.ts";
import { group } from "./capabilities/group.ts";
import { toolLazy } from "../../config/capabilities/resolve-tool-lazy.ts";
import { toolGroupLazy } from "../../config/capabilities/resolve-tool-group-lazy.ts";
import { META_TOOL_NAMES } from "../tool-declarations/meta-tool-names.ts";
import { resolveCapability } from "../../config/capabilities/resolve-capability.ts";

export function projectCapabilities(
  entries: CatalogCapabilityEntry[],
  defaults: { capabilities: CapabilitySwitches; localTools: boolean },
  overrides: CapabilitySwitches,
  localOverride: boolean | undefined,
  local: boolean,
  skillDirectories: readonly SkillDirectory[] = [],
  lazyLayers: readonly CapabilitySwitches[] = [overrides, defaults.capabilities],
): CapabilityCatalog {
  entries = entries.filter((entry) => entry.kind !== "tool" || !Object.hasOwn(META_TOOL_NAMES, entry.name));
  const ctx: CapabilityProjectionContext = { entries, defaults, overrides, localOverride, local, skillDirectories };
  const groups = [...new Map([
    ...skillDirectories.map((directory) => group(ctx, skillDirectoryGroup(directory), skillDirectoryLabel(directory), "skill")),
    ...entries.map((entry) => group(ctx, entry.group, entry.groupLabel, entry.kind)),
  ].map((entry) => [entry.id, entry])).values()];
  const winners = new Map<string, string>();
  const projected = entries.map(({ shadowedBy: _shadowed, lazy: _lazy, ...entry }) => {
    const groupEnabled = value(ctx, entry.group);
    const available = entry.available !== false || entry.group === LOCAL_TOOLS_GROUP;
    const enabled = available && (entry.locked === true || (entry.group === LOCAL_TOOLS_GROUP
      ? groupEnabled && resolveCapability(entry.id, undefined, lazyLayers)
      : resolveCapability(entry.id, entry.group, lazyLayers)));
    const shadowedBy = entry.kind === "skill" ? winners.get(entry.name) : undefined;
    if (entry.kind === "skill" && enabled && !shadowedBy) winners.set(entry.name, entry.id);
    const lazy = entry.kind === "tool" && entry.id.startsWith("tool:") ? toolLazy({ ...entry, enabled }, lazyLayers) : undefined;
    return { ...entry, enabled, configured: value(ctx, entry.id),
      defaultEnabled: defaultValue(ctx, entry.id), overridden: overridden(ctx, entry.id), groupEnabled,
      available,
      ...(shadowedBy ? { shadowedBy } : {}),
      ...(lazy ? { lazy } : {}),
    };
  });
  for (const group of groups) {
    const lazy = toolGroupLazy(group.id, projected.some((entry) => entry.group === group.id && entry.lazy?.available === true), lazyLayers);
    if (lazy) group.lazy = lazy;
  }
  return { entries: projected, groups, localTools: value(ctx, LOCAL_TOOLS_GROUP), requiresReload: false };
}
