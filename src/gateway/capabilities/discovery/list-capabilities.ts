import type { HostContext } from "../../host/host-state.ts";
import type { CapabilitySettings } from "../../../config/capabilities/capability-types.ts";
import { loadGatewayCapabilityCatalog } from "../../../sessions/global-catalog/load-catalog.ts";
import { discoverKernelToolCatalog } from "../../../codemode/module-catalog/discover-kernel-tool-catalog.ts";
import { projectCapabilities } from "../../../sessions/resource-catalog/format-capabilities.ts";
import { createSessionsPluginGateway } from "../../derivation/create-sessions-plugin-gateway.ts";

export async function instanceCapabilitiesList(ctx: HostContext, instance?: string, refresh = false): Promise<CapabilitySettings> {
    const settings = ctx.methods.capabilitiesList();
    if (instance === undefined) {
      for (const target of ctx.instances.targets) if (ctx.methods.remoteConfiguration(target.id).packages.length) await ctx.methods.instanceCapabilitiesList(target.id, refresh);
      return ctx.methods.capabilitiesList();
    }
    const target = ctx.instances.targets.find((target) => target.id === instance);
    if (!target) return { ...settings, instanceError: "Instance is not configured." };
    if (refresh || !ctx.capabilities.instanceExtensionCatalogs.has(instance)) {
      const modelRuntime = await ctx.methods.sharedModelRuntime();
      const separator = ctx.host.options.model.indexOf("/");
      const model = ctx.host.dependencies.runtimeDependencies?.model ?? (separator > 0 ? modelRuntime.getModel(ctx.host.options.model.slice(0, separator), ctx.host.options.model.slice(separator + 1)) : undefined);
      const catalog = await loadGatewayCapabilityCatalog({
        signal: ctx.lifecycle.extensionLifetime.signal,
        cwd: ctx.host.paths.home, agentDir: ctx.host.paths.agentDir, modelRuntime, model,
        modelProviders: ctx.models.modelProviders,
        pluginWarnings: ctx.packages.pluginWarnings,
        pluginFailures: ctx.packages.pluginFailures,
        config: { ...ctx.host.config, extensions: ctx.packages.extensionConfig }, skillLibrary: ctx.host.skillLibrary, toolLibrary: ctx.host.toolLibrary,
        sessions: createSessionsPluginGateway(ctx), memoryStore: ctx.host.memoryStore, pluginConfig: ctx.host.pluginConfig,
        remoteExtensions: { target, channels: ctx.host.channels, storeDir: ctx.host.artifactStore.directory, store: ctx.host.artifactStore, nativeTools: false, hostOptions: ctx.host.config.remoteHost, ...ctx.methods.remoteConfiguration(instance), ...ctx.host.dependencies,
          binChunkBytes: ctx.host.config.codemode.binChunkBytes,
          onStatus(status) { if (status.length) ctx.packages.remoteCatalogStatuses.set(instance, status); },
        },
      });
      ctx.capabilities.globalCapabilityCatalog.entries = ctx.capabilities.globalCapabilityCatalog.entries.filter((entry) => entry.instance !== instance);
      ctx.capabilities.instanceExtensionCatalogs.set(instance, catalog);
      ctx.methods.mergeCapabilityCatalog(catalog);
    }
    const helpers = await discoverKernelToolCatalog(ctx.host.paths.home, instance);
    const entries: Parameters<typeof projectCapabilities>[0] = [
      ...settings.catalog.entries.filter((entry) => !entry.id.startsWith("kernel:") && !entry.instance),
      ...(ctx.capabilities.instanceExtensionCatalogs.get(instance)?.entries.filter((entry) => entry.instance === instance) ?? []),
      ...helpers.map((helper) => ({
        id: `kernel:${helper.name}`, kind: "tool" as const, name: helper.name,
        description: `${helper.name}${helper.signature}\n${helper.description}`, group: "group:tools:kernel", groupLabel: "kernel 函数",
        source: helper.source ?? "PRK kernel prelude", available: helper.available, module: helper.module,
        error: helper.error, overridesBuiltin: helper.overridesBuiltin, dependencies: helper.dependencies,
        moduleOnly: helper.moduleOnly, pending: helper.pending,
      })),
    ];
    return {
      ...settings,
      catalog: { ...projectCapabilities(entries, ctx.capabilities.capabilityDefaults, target.capabilities ?? {}, undefined, target.local),
        providerErrors: ctx.methods.capabilitiesList().catalog.providerErrors },
    };
  }
