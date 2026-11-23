import type { HostContext } from "../host-state.ts";
import { createSessionCollection } from "../../../sessions/collection/assemble-collection.ts";
import { readDerivedSession } from "../../../sessions/derivation/read-derived-session.ts";
import { readNativeSessionState } from "../../../sessions/history/read-native-session-state.ts";
import { restoreSessionModel } from "../../models/restore-session-model.ts";
import type { TargetFileContext } from "../../../workspace/target-files/files-types.ts";
import { createModelTerminals } from "../../../workspace/model-terminals/create-terminals.ts";
import { createSessionsPluginGateway } from "../../derivation/create-sessions-plugin-gateway.ts";
import { readIsolationEnvironment } from "../../../sessions/derivation/read-isolation-environment.ts";
import { pythonIndexEnvironment } from "../../../target-environment/python/python-index-environment.ts";

export function assembleSessionCollection(ctx: HostContext): void {
  ctx.host.factory = ctx.host.dependencies.collectionFactory ?? createSessionCollection;
  const factory = ctx.host.factory;
  ctx.host.collection = factory(ctx.instances.targets, {
    limits: ctx.host.config.limits,
    getRuntimeDependencies: ctx.methods.runtimeBase,
    configureRuntimeDependencies: (sessionId, base, manager) => {
      const persisted = manager ? readDerivedSession(manager, ctx.derivation.derivationSchemas) : undefined;
      const nativeState = manager ? readNativeSessionState(manager, ctx.host.config.limits) : {};
      const selected = restoreSessionModel(ctx, sessionId, base, manager, nativeState, persisted);
      return {
        ...base,
        modelProviders: ctx.models.modelProviders ?? base.modelProviders,
        agentDir: ctx.host.paths.agentDir,
        sessionOptions: ctx.host.config.session,
        capabilityDefaults: (instance) => ({ ...ctx.capabilities.capabilityDefaults, capabilities: {
          ...ctx.capabilities.capabilityDefaults.capabilities, ...ctx.instances.targets.find((target) => target.id === instance)?.capabilities,
        } }),
        capabilityLayers: (instance) => [ctx.instances.targets.find((target) => target.id === instance)?.capabilities ?? {}, ctx.capabilities.capabilityDefaults.capabilities],
        globalCapabilityCatalog: () => ctx.methods.capabilitiesList().catalog,
        onCapabilityCatalog: ctx.methods.mergeCapabilityCatalog,
        targetChannels: ctx.host.channels,
        requireEnvironment: ctx.methods.requireEnvironment,
        targetEnvironments: ctx.host.environments,
        targetCacheRoot: ctx.host.config.targetCacheRoot,
        pythonEnvironment: (target, paths) => pythonIndexEnvironment(target.pythonIndexUrl ?? ctx.host.config.pythonIndexUrl, paths),
        processWindow: ctx.host.config.processWindow,
        remoteExtensions: ctx.methods.remoteConfiguration,
        remoteExtensionOptions: { channels: ctx.host.channels, storeDir: ctx.host.artifactStore.directory, store: ctx.host.artifactStore, hostOptions: ctx.host.config.remoteHost, ...ctx.host.dependencies,
          binChunkBytes: ctx.host.config.codemode.binChunkBytes,
          telemetryIntervalMs: ctx.host.config.kernel.telemetryIntervalMs,
          onMonitor(value) { ctx.monitoring.monitor.reportRemoteHost(sessionId, value); },
          onStatus(status) { if (status.length) ctx.packages.remoteStatuses.set(sessionId, status); else ctx.packages.remoteStatuses.delete(sessionId); },
          onFrozen(generation) {
            if (ctx.lifecycle.closing) return Promise.resolve();
            const owner = ctx.host.collection.get(sessionId)?.host;
            return ctx.methods.changeSessionRuntime(sessionId, async () => {
              const current = ctx.host.collection.get(sessionId);
              if (!current || current.host !== owner) return;
              ctx.sessionHosts.hostBindings.get(sessionId)?.fence();
              await Promise.all([current.kernel.prepareHandoff?.(), generation.close("frozen")]);
              await current.session.waitForIdle();
              if (!current.host.isIdle) await new Promise<void>((resolve) => {
                const subscription = current.host.subscribe(() => {
                  if (current.host.isIdle) { subscription.unsubscribe(); resolve(); }
                });
                if (current.host.isIdle) { subscription.unsubscribe(); resolve(); }
              });
              if (ctx.lifecycle.closing || ctx.host.collection.get(sessionId) !== current) return;
              try { await ctx.host.collection.reload(sessionId); }
              finally {
                ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true);
                ctx.methods.publishCapabilities(sessionId);
              }
            });
          },
        },
        projectId: () => ctx.host.history.get(sessionId)?.projectId,
        projectName: () => ctx.host.history.get(sessionId)?.projectName,
        learningOptions: ctx.host.config.learning,
        extensionFilter: ctx.packages.extensionConfig,
        pluginFailures: ctx.packages.pluginFailures,
        terminalOptions: ctx.workspace.terminalOptions,
        kernelExecutionPolicy: () => ctx.host.config.kernel,
        toolTitle: () => ctx.host.config.session.toolTitle,
        traceOptions: ctx.host.config.trace,
        codemodeOptions: ctx.host.config.codemode,
        namespaceOptions: ctx.host.config.namespace,
        kernelModuleConfig: ctx.host.config.kernelTools,
        toolLibrary: ctx.host.toolLibrary,
        skillLibrary: ctx.host.skillLibrary,
        memoryStore: ctx.host.memoryStore,
        memoryOptions: ctx.host.config.memory,
        pluginConfig: ctx.host.pluginConfig,
        modelTerminals: (context: TargetFileContext) => {
          let controller = ctx.workspace.modelTerminals.get(sessionId);
          if (!controller) {
            controller = createModelTerminals({ sessionId: sessionId, context, environment: manager ? readIsolationEnvironment(manager) : {}, terminals: ctx.workspace.terminals, options: ctx.workspace.terminalOptions, limits: ctx.host.config.limits });
            ctx.workspace.modelTerminals.set(sessionId, controller);
          }
          return controller;
        },
        limits: ctx.host.config.limits,
        ...(selected ? { model: selected.model, thinkingLevel: selected.thinkingLevel } : {}),
        ...(nativeState.autoCompaction === undefined ? {} : { autoCompaction: nativeState.autoCompaction }),
        ...(nativeState.autoRetry === undefined ? {} : { autoRetry: nativeState.autoRetry }),
        ...(nativeState.scopedModels === undefined ? {} : { scopedModels: nativeState.scopedModels }),
        ...(persisted?.instructions ? { roleInstructions: persisted.instructions } : {}),
        sessions: createSessionsPluginGateway(ctx, sessionId),
      };
    },
  });
}
