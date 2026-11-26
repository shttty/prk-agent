import type { CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import { resolveCapability } from "../../config/capabilities/resolve-capability.ts";
import { packageLoadId } from "./package-load-id.ts";
import type { LoadablePackage } from "./package-load-types.ts";

/** `layers` run from the most specific to the global default, like every capability switch. */
export function unloadedPackageSources(packages: readonly LoadablePackage[], layers: readonly CapabilitySwitches[]): string[] {
  return packages.filter((pkg) => !resolveCapability(packageLoadId(pkg.source), undefined, layers)).map((pkg) => pkg.source);
}
