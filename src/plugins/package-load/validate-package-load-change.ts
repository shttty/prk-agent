import type { CapabilityChange } from "../../config/capabilities/capability-types.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { packageLoadId } from "./package-load-id.ts";
import type { LoadablePackage } from "./package-load-types.ts";
import { providerUnloadError } from "./provider-unload-error.ts";

export function validatePackageLoadChange(packages: readonly LoadablePackage[], { id, enabled }: CapabilityChange): void {
  const pkg = packages.find((entry) => packageLoadId(entry.source) === id);
  if (!pkg) {
    // A reset may clear the key of a package that is gone; anything else needs an installed package.
    if (enabled === null) return;
    throw new WireError("NOT_FOUND", "Package is not installed or enabled.");
  }
  if (enabled === false && pkg.providerIds.length) throw providerUnloadError(pkg);
}
