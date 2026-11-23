import type { HostContext } from "../host/host-state.ts";
import type { PluginList } from "../../plugins/packages/package-types.ts";
import { resolvePluginPackages } from "../../plugins/packages/resolve-packages.ts";
import { readPluginPackages } from "../../plugins/packages/read-packages.ts";
import { requiresProviderRestart } from "./requires-provider-restart.ts";

export async function pluginsList(ctx: HostContext): Promise<PluginList> {
  await ctx.methods.capabilitiesRefresh();
  const local = ctx.instances.targets.find((target) => target.local);
  if (local) await ctx.methods.instanceCapabilitiesList(local.id, true);
  const statuses = [...ctx.packages.remoteCatalogStatuses.values(), ...ctx.packages.remoteStatuses.values()].flat();
  const diagnostics = [...(ctx.models.modelProviders?.errors ?? []), ...(ctx.capabilities.globalCapabilityCatalog.providerErrors ?? [])];
  const restartRequired = requiresProviderRestart(ctx, readPluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir), diagnostics);
  return { restartRequired, packages: resolvePluginPackages(ctx.host.paths.home, ctx.host.paths.agentDir).map(({ agentDir: _agentDir, ...pkg }) => {
    const observed = statuses.filter((entry) => entry.name === pkg.source);
    const providerErrors = [...diagnostics, ...observed.flatMap((entry) => entry.providerErrors ?? [])]
      .filter((error) => error.source === pkg.source || observed.some((entry) => entry.providerErrors?.includes(error)));
    const providerIds = [...new Set([
      ...[...(ctx.models.modelProviders?.owners ?? [])].filter(([, owner]) => owner.source === pkg.source).map(([id]) => id),
      ...providerErrors.map((error) => error.providerId),
    ])];
    const commands = [...new Map(observed.flatMap((entry) => entry.commands ?? []).map((command) => [command.name, command])).values()];
    const failure = observed.find((entry) => entry.error);
    const warnings = pkg.enabled && pkg.location === "gateway" ? [...(ctx.packages.pluginWarnings.get(pkg.source) ?? [])] : [];
    const startupError = pkg.enabled && pkg.location === "gateway" ? ctx.packages.pluginFailures.get(pkg.source) : undefined;
    return { ...pkg, commands, providerIds, providerErrors, warnings, ...(startupError !== undefined ? { error: startupError, errorCode: "PLUGIN_STARTUP_FAILED" }
      : failure ? { error: failure.error, errorCode: failure.errorCode, errorDetails: failure.errorDetails } : {}) };
  }) };
}
