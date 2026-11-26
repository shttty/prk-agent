import { WireError } from "../../gateway/wire/create-error.ts";
import type { LoadablePackage } from "./package-load-types.ts";

/** Provider registration is Gateway-wide state, so no instance, role or session can unload its package. */
export function providerUnloadError(pkg: LoadablePackage): WireError {
  const error = `Package ${JSON.stringify(pkg.name)} registers provider ${pkg.providerIds.join(", ")}; providers are shared by the whole Gateway, so a load switch cannot unload it. Disable the package in plugin settings instead (applies after a Gateway restart).`;
  return new WireError("PROVIDER_POLICY", error, {
    providerErrors: pkg.providerIds.map((providerId) => ({ code: "PROVIDER_POLICY", providerId, operation: "unregister", path: pkg.source, source: pkg.source, error })),
  });
}
