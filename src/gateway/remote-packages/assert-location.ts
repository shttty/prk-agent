import type { HostContext } from "../host/host-state.ts";
import type { PluginLocation } from "../../plugins/packages/package-types.ts";
import { WireError } from "../wire/create-error.ts";

export function assertPluginLocation(ctx: HostContext, source: string, location: PluginLocation): void {
  if (location !== "host") return;
  const owners = [...(ctx.models.modelProviders?.owners ?? [])].filter(([, owner]) => owner.source === source);
  for (const error of ctx.capabilities.globalCapabilityCatalog.providerErrors ?? []) {
    if (error.source === source && error.operation === "register" && !owners.some(([id]) => id === error.providerId)) owners.push([error.providerId, { source, extensionPath: error.path }]);
  }
  if (!owners.length) return;
  const providerErrors = owners.map(([providerId, owner]) => ({ code: "PROVIDER_POLICY", providerId, operation: "register", path: owner.extensionPath, source,
    error: "Provider plugins can only run in Gateway; choose Gateway explicitly." }));
  throw new WireError("PROVIDER_POLICY", providerErrors[0]!.error, { providerErrors });
}
