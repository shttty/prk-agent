import { isDeepStrictEqual } from "node:util";
import type { HostContext } from "../host/host-state.ts";
import type { PluginPackage } from "../../plugins/packages/package-types.ts";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";

export function requiresProviderRestart(ctx: HostContext, packages: readonly PluginPackage[], errors: readonly ProviderPolicyError[]): boolean {
  const loaded = ctx.models.providerRuntime?.services.settingsManager.getGlobalSettings().packages ?? [];
  const owners = new Set([...(ctx.models.modelProviders?.owners.values() ?? [])].map((owner) => owner.source));
  const sources = new Set([...owners, ...errors.filter((error) => error.operation === "register" && error.source).map((error) => error.source!)]);
  for (const source of sources) {
    const saved = packages.find((pkg) => pkg.source === source);
    const previous = loaded.find((pkg) => (typeof pkg === "string" ? pkg : pkg.source) === source);
    if (!saved || !saved.enabled || saved.location !== "gateway") {
      if (owners.has(source) && previous !== undefined) return true;
      continue;
    }
    const { enabled: _enabled, location: _location, ...native } = saved;
    if (!isDeepStrictEqual(native, typeof previous === "string" ? { source: previous } : previous)) return true;
  }
  return false;
}
