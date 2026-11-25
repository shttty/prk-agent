import type { HostContext } from "./host-state.ts";
import type { GatewayHostOptions } from "./host-types.ts";
import type { GatewayHostDependencies } from "./host-types.ts";
import type { GatewaySessionHost } from "./host-types.ts";
import { initializePrkHome } from "../../config/home/initialize-prk-home.ts";
import { warnMissingAgentSettings } from "../../config/home/warn-missing-agent-settings.ts";
import { loadPrkConfig } from "../../config/document/load-prk-config.ts";
import { rejectLegacyJsonConfig } from "../../config/document/storage/reject-legacy-json.ts";
import { WireError } from "../wire/create-error.ts";
import { assembleHost } from "./assemble-host.ts";
import { bindHostApi } from "./lifecycle/bind-host-api.ts";
import { openHostLibraries } from "./resources/open-host-libraries.ts";
import { openHistory } from "./resources/open-history.ts";
import type { ModelTerminals } from "../../workspace/model-terminals/model-terminals-types.ts";
import { assembleSessionCollection } from "./lifecycle/assemble-session-collection.ts";
import type { SessionHost } from "../../sessions/host/host-types.ts";
import type { HostBinding } from "../session-hosts/host-binding-state.ts";
import type { SessionRecovery } from "../../sessions/collection/collection-types.ts";
import { createNativeInteractionService } from "../../sessions/native-interaction/assemble-native-interaction.ts";
import type { GatewayCollectionEvent } from "../instance-environments/environment-types.ts";
import { openWorkspace } from "../workspace/open-workspace.ts";
import { openTargetChannels } from "./resources/open-target-channels.ts";
import { openMonitor } from "../monitoring/open-monitor.ts";
import { observeCollection } from "../collection-events/observe-collection.ts";
import { openDerivation } from "../derivation/open-derivation.ts";
import { openPeerMessages } from "../peer-messages/open-peer-messages.ts";
import { startIdleReclamation } from "../session-lifecycle/start-idle-reclamation.ts";
import { openSessionControl } from "../session-control/open-session-control.ts";
import { backfillProjectRecords } from "../projects/backfill-project-records.ts";

export async function createGatewayHost(options: GatewayHostOptions, dependencies: GatewayHostDependencies = {}): Promise<GatewaySessionHost> {
  const paths = initializePrkHome(options.home);
  warnMissingAgentSettings(paths.agentDir);
  if (options.config !== undefined) {
    try { await rejectLegacyJsonConfig(paths.home); }
    catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
  }
  const config = options.config ?? await loadPrkConfig(paths.home);
  const ctx = assembleHost(options, dependencies, paths, config);
  openHostLibraries(ctx);
  ctx.host.history = await openHistory(ctx);
  ctx.host.projectDates = new Map();
  backfillProjectRecords(ctx);
  openSessionControl(ctx);
  ctx.models.runtimeDependencies = undefined;
  ctx.models.modelRuntime = undefined;
  ctx.models.modelFallbacks = new Map();
  ctx.capabilities.globalCapabilityCatalog = { entries: [], groups: [], localTools: ctx.capabilities.capabilityDefaults.localTools, requiresReload: false };
  ctx.capabilities.catalogLoading = undefined;
  ctx.workspace.modelTerminals = new Map<string, ModelTerminals>();
  assembleSessionCollection(ctx);
  ctx.sessionHosts.hosts = new Map<string, SessionHost>();
  ctx.views.archivedStreamIds = new Map<string, string>();
  ctx.sessionHosts.hostBindings = new Map<string, HostBinding>();
  ctx.lifecycle.transitions = new Map<string, Promise<void>>();
  ctx.lifecycle.recoveryStates = new Map<string, SessionRecovery>();
  ctx.native.nativeInteractions = createNativeInteractionService({
    lifecycle: ctx.methods.runNativeLifecycle,
    dispatchAction: (request) => ctx.methods.nativeAction(request.sessionId, request),
    limits: ctx.host.config.limits,
    sessionOptions: ctx.host.config.session,
    referencesOptions: ctx.host.config.references,
  });
  ctx.events.listeners = new Set<(event: GatewayCollectionEvent) => void>();
  ctx.lifecycle.mutationInProgress = false;
  ctx.lifecycle.runtimeChanges = 0;
  ctx.lifecycle.closing = undefined;
  ctx.lifecycle.extensionLifetime = new AbortController();
  openTargetChannels(ctx);
  openWorkspace(ctx);
  openMonitor(ctx);
  ctx.monitoring.kernelWatches = new Map<string, { readonly kernel: object; unsubscribe(): void }>();
  ctx.monitoring.monitorQueued = false;
  observeCollection(ctx);
  openDerivation(ctx);
  openPeerMessages(ctx);
  startIdleReclamation(ctx);
  ctx.lifecycle.idleTimer.unref();
  ctx.api = bindHostApi(ctx);
  try { await ctx.methods.capabilitiesRefresh(); }
  catch (error) {
    try { await ctx.api.close(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], "Gateway capability initialization and shutdown failed."); }
    throw error;
  }
  return ctx.api;
}
