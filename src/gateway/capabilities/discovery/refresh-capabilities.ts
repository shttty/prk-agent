import type { HostContext } from "../../host/host-state.ts";
import type { CapabilitySettings } from "../../../config/capabilities/capability-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { loadGatewayCapabilityCatalog } from "../../../sessions/global-catalog/load-catalog.ts";
import { createSessionsPluginGateway } from "../../derivation/create-sessions-plugin-gateway.ts";

export async function capabilitiesRefresh(ctx: HostContext, instance?: string): Promise<CapabilitySettings> {
    return ctx.methods.exclusive(async () => {
      if (instance !== undefined) return ctx.methods.instanceCapabilitiesList(instance, true);
      const loading = (async () => {
        const runtime = await ctx.methods.sharedModelRuntime();
        if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; capability inventory was not replaced.");
        const separator = ctx.host.options.model.indexOf("/");
        const model = ctx.host.dependencies.runtimeDependencies?.model ?? (separator > 0 ? runtime.getModel(ctx.host.options.model.slice(0, separator), ctx.host.options.model.slice(separator + 1)) : undefined);
        const catalog = await loadGatewayCapabilityCatalog({
          signal: ctx.lifecycle.extensionLifetime.signal,
          cwd: ctx.host.paths.home,
          agentDir: ctx.host.paths.agentDir,
          modelRuntime: runtime,
          modelProviders: ctx.models.modelProviders,
          model,
          config: { ...ctx.host.config, extensions: ctx.packages.extensionConfig },
          pluginWarnings: ctx.packages.pluginWarnings,
          pluginFailures: ctx.packages.pluginFailures,
          onPluginCommands(packages) {
            ctx.packages.remoteCatalogStatuses.set("", packages.map((pkg) => ({ name: pkg.source, instance: "", location: "local", commands: pkg.commands })));
          },
          extensionPaths: ctx.host.options.extensionPaths,
          skillLibrary: ctx.host.skillLibrary,
          toolLibrary: ctx.host.toolLibrary,
          sessions: createSessionsPluginGateway(ctx),
          memoryStore: ctx.host.memoryStore,
          pluginConfig: ctx.host.pluginConfig,
        });
        if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; capability inventory was not replaced.");
        ctx.capabilities.globalCapabilityCatalog = catalog;
        for (const instanceCatalog of ctx.capabilities.instanceExtensionCatalogs.values()) ctx.methods.mergeCapabilityCatalog(instanceCatalog);
      })();
      ctx.capabilities.catalogLoading = loading;
      try {
        await loading;
        for (const session of ctx.host.collection.snapshot()) {
          if (session.state !== "closed" && session.state !== "closing") ctx.methods.publishCapabilities(session.sessionId);
        }
        return ctx.methods.capabilitiesList();
      } finally {
        if (ctx.capabilities.catalogLoading === loading) ctx.capabilities.catalogLoading = undefined;
      }
    });
  }
