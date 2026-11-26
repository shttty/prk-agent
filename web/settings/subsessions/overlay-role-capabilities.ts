import type { CapabilityCatalog, CapabilityEntry, CapabilityGroup } from "../capabilities/capability-types.ts";

const hasOwn = (object: object, key: string) => Boolean(object && Object.prototype.hasOwnProperty.call(object, key));

/**
 * Overlay a role's sparse `capabilities` map (`Record<string, boolean>`) onto the global `/api/capabilities` catalog
 * for `kind` ("tools" | "skills"), returning `{ groups, entriesByGroup }` with effective enabled/lazy/overridden flags.
 */
export function overlayRoleCapabilities(catalog: CapabilityCatalog | null, roleCapabilities: Record<string, boolean> | undefined, kind: string): { groups: CapabilityGroup[]; entriesByGroup: Map<string, CapabilityEntry[]> } {
  const targetKind = kind === "skills" ? "skill" : "tool";
  const overrides: Record<string, boolean> = roleCapabilities ?? {};
  const rawGroups = (catalog?.groups || []).filter((group) => group.kind === targetKind);
  const rawEntries = (catalog?.entries || []).filter((entry) => entry.kind === targetKind);

  const groups: CapabilityGroup[] = rawGroups.map((group) => {
    const baseEnabled = group.enabled !== false;
    const overridden = hasOwn(overrides, group.id);
    const enabled = overridden ? Boolean(overrides[group.id]) : baseEnabled;
    let lazy = group.lazy;
    if (lazy?.id) {
      const lazyOverridden = hasOwn(overrides, lazy.id);
      const lazyEnabled = lazyOverridden ? Boolean(overrides[lazy.id]) : lazy.enabled === true;
      lazy = { ...lazy, enabled: lazyEnabled, defaultEnabled: lazy.enabled === true, overridden: lazyOverridden, available: lazy.available !== false };
    }
    return { ...group, enabled, defaultEnabled: baseEnabled, overridden, ...(lazy ? { lazy } : {}) };
  });

  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const entriesByGroup = new Map<string, CapabilityEntry[]>(groups.map((group) => [group.id, []]));

  for (const entry of rawEntries) {
    const parentGroup = groupMap.get(entry.group);
    const groupEnabled = parentGroup ? parentGroup.enabled !== false : entry.groupEnabled !== false;
    const baseConfigured = entry.configured !== undefined ? entry.configured === true : entry.enabled !== false;
    const overridden = hasOwn(overrides, entry.id);
    const configured = entry.locked === true ? true : (overridden ? Boolean(overrides[entry.id]) : baseConfigured);
    const enabled = groupEnabled && configured;
    let lazy = entry.lazy;
    if (lazy?.id) {
      const groupLazyId = parentGroup?.lazy?.id ?? `lazy:${entry.group}`;
      const lazyOverridden = hasOwn(overrides, lazy.id);
      const groupLazyOverride = hasOwn(overrides, groupLazyId) ? Boolean(overrides[groupLazyId]) : undefined;
      const baseLazy = lazy.enabled === true;
      const lazyEnabled = lazyOverridden ? Boolean(overrides[lazy.id]) : (groupLazyOverride !== undefined ? groupLazyOverride : baseLazy);
      const available = entry.exposure !== "model-only" && (lazy.available !== false || !entry.enabled);
      lazy = { ...lazy, enabled: lazyEnabled, defaultEnabled: baseLazy, overridden: lazyOverridden, available };
    }
    const projected = {
      ...entry,
      catalogued: true,
      groupEnabled,
      configured,
      enabled,
      defaultEnabled: baseConfigured,
      overridden,
      ...(lazy ? { lazy } : {}),
    };
    if (!entriesByGroup.has(entry.group)) {
      const fallbackGroup: CapabilityGroup = { id: entry.group, kind: targetKind, name: entry.groupLabel || entry.group, enabled: groupEnabled, available: true, overridden: hasOwn(overrides, entry.group) };
      groups.push(fallbackGroup);
      groupMap.set(entry.group, fallbackGroup);
      entriesByGroup.set(entry.group, []);
    }
    entriesByGroup.get(entry.group)?.push(projected);
  }

  return { groups: groups.filter((group) => (entriesByGroup.get(group.id)?.length || 0) > 0), entriesByGroup };
}
