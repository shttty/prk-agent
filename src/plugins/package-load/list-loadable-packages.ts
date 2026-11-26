import type { HostPluginPackage } from "../packages/package-types.ts";
import type { ModelProviderOwnership } from "../../sessions/model-providers/provider-types.ts";
import type { LoadablePackage } from "./package-load-types.ts";

/** Providers are registered once for the whole Gateway, so ownership comes from bootstrap, not from any session. */
export function listLoadablePackages(packages: readonly HostPluginPackage[], ownership: ModelProviderOwnership | undefined): LoadablePackage[] {
  return packages.filter((pkg) => pkg.enabled).map(({ source, name, location }) => ({
    source, name, location,
    providerIds: [...new Set([
      ...[...(ownership?.owners ?? [])].filter(([, owner]) => owner.source === source).map(([id]) => id),
      ...(ownership?.errors ?? []).filter((error) => error.operation === "register" && error.source === source).map((error) => error.providerId),
    ])],
  }));
}
