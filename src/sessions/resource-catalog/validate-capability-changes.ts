import type { CapabilityCatalog, CapabilityChange } from "../../config/capabilities/capability-types.ts";
import type { LoadablePackage } from "../../plugins/package-load/package-load-types.ts";
import { validatePackageLoadChange } from "../../plugins/package-load/validate-package-load-change.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export function validateCapabilityChanges(catalog: CapabilityCatalog, changes: readonly CapabilityChange[], session = false, packages: readonly LoadablePackage[] = []): void {
  for (const change of changes) {
    const { id, enabled } = change;
    if (id.startsWith("load:package:")) { validatePackageLoadChange(packages, change); continue; }
    const entry = catalog.entries.find((entry) => entry.id === id || entry.lazy?.id === id);
    const group = catalog.groups.find((group) => group.id === id || group.lazy?.id === id);
    if (!entry && !group) throw new WireError("NOT_FOUND", "Capability is not present in the inventory.");
    const lazy = entry?.lazy?.id === id ? entry.lazy : group?.lazy?.id === id ? group.lazy : undefined;
    if (lazy) {
      if (!lazy.available) throw new WireError("INVALID_REQUEST", "Lazy loading is unavailable for this capability.");
    } else {
      if (entry?.locked && (session || enabled !== true)) throw new WireError("INVALID_REQUEST", "This capability is required by the active tool mode.");
      if ((entry?.available === false || group?.available === false) && enabled === true) throw new WireError("INVALID_REQUEST", entry?.error ?? "This capability is unavailable on this instance.");
    }
  }
}
