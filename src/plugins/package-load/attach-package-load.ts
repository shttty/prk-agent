import type { CapabilityCatalog, CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import { lazyState } from "../../config/capabilities/resolve-lazy-state.ts";
import { entryPackageSource } from "./find-entry-package.ts";
import { packageLoadId } from "./package-load-id.ts";
import type { LoadablePackage } from "./package-load-types.ts";

/**
 * Adds each package's load switch as `layers[0]` sees it (`defaultEnabled` is what the layers below give it), and
 * tags every tool or skill group with the package it comes from so a page can put the switch beside it.
 */
export function attachPackageLoad(catalog: CapabilityCatalog, packages: readonly LoadablePackage[], layers: readonly CapabilitySwitches[]): CapabilityCatalog {
  return {
    ...catalog,
    groups: catalog.groups.map((group) => {
      const source = entryPackageSource(group.id, packages);
      return source === undefined ? group : { ...group, package: source };
    }),
    packages: packages.map((pkg) => ({ ...pkg, providerIds: [...pkg.providerIds], load: lazyState(packageLoadId(pkg.source), undefined, true, true, layers) })),
  };
}
