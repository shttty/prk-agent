import type { DerivationConfig } from "../../config/derivation/derivation-types.ts";
import { packageLoadId } from "../../plugins/package-load/package-load-id.ts";
import type { LoadablePackage } from "../../plugins/package-load/package-load-types.ts";
import { providerUnloadError } from "../../plugins/package-load/provider-unload-error.ts";

/** A role is a switch layer too: it may not unload a package that owns Gateway-wide providers. */
export function rejectProviderRoleUnload(derivation: DerivationConfig, packages: readonly LoadablePackage[]): void {
  for (const role of Object.values(derivation.roles ?? {})) {
    const provider = packages.find((pkg) => pkg.providerIds.length && role?.capabilities?.[packageLoadId(pkg.source)] === false);
    if (provider) throw providerUnloadError(provider);
  }
}
