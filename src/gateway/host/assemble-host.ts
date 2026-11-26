import type { HostContext } from "./host-state.ts";
import { assembleRemotePackages } from "../remote-packages/assemble-remote-packages.ts";
import { assembleModels } from "../models/assemble-models.ts";
import { assembleWorkspace } from "../workspace/assemble-workspace.ts";
import { assembleMonitoring } from "../monitoring/assemble-monitoring.ts";
import { assembleSessionViews } from "../session-views/assemble-session-views.ts";
import { assembleArchives } from "../archives/assemble-archives.ts";
import { assembleCapabilities } from "../capabilities/assemble-capabilities.ts";
import { assembleSessionLifecycle } from "../session-lifecycle/assemble-session-lifecycle.ts";
import { assembleInstances } from "../instances/assemble-instances.ts";
import { assembleDerivation } from "../derivation/assemble-derivation.ts";
import { assembleNativeInteractions } from "../native-interactions/assemble-native-interactions.ts";
import { assembleProjects } from "../projects/assemble-projects.ts";
import { assembleArtifacts } from "../artifacts/assemble-artifacts.ts";
import { assembleToolLibrary } from "../tool-library/assemble-tool-library.ts";
import { assembleSkillLibrary } from "../skill-library/assemble-skill-library.ts";
import { assembleThemes } from "../themes/assemble-themes.ts";
import { assembleMemories } from "../memories/assemble-memories.ts";
import { assemblePluginConfiguration } from "../plugin-configuration/assemble-plugin-configuration.ts";
import { assembleCollectionEvents } from "../collection-events/assemble-collection-events.ts";
import { close } from "./lifecycle/close-host.ts";
import type { GatewayHostOptions } from "./host-types.ts";
import type { GatewayHostDependencies } from "./host-types.ts";
import type { PrkConfig } from "../../config/document/document-types.ts";
import type { HostState } from "./host-state.ts";
import { kernelExecutionGet } from "../kernel-execution/read-settings.ts";
import { kernelExecutionSet } from "../kernel-execution/save-settings.ts";
import { toolTitleGet } from "../tool-title/read-settings.ts";
import { toolTitleSet } from "../tool-title/save-settings.ts";
import { soulGet } from "../soul/read-soul-settings.ts";
import { soulSave } from "../soul/save-soul.ts";

import { assembleSessionControl } from "../session-control/assemble-session-control.ts";
export function assembleHost(options: GatewayHostOptions, dependencies: GatewayHostDependencies, paths: HostState["paths"], config: PrkConfig): HostContext {
  const ctx = {
    host: { options, dependencies, paths, config },
    packages: {},
    capabilities: {},
    workspace: {},
    derivation: {},
    control: {},
    lifecycle: {},
    instances: {},
    models: {},
    sessionHosts: {},
    views: {},
    native: {},
    events: {},
    monitoring: {},
    peerMessages: {},
  } as HostContext;
  ctx.methods = {
    ...assembleRemotePackages(ctx),
    ...assembleModels(ctx),
    ...assembleWorkspace(ctx),
    ...assembleMonitoring(ctx),
    ...assembleSessionViews(ctx),
    ...assembleArchives(ctx),
    ...assembleCapabilities(ctx),
    ...assembleSessionLifecycle(ctx),
    ...assembleInstances(ctx),
    ...assembleDerivation(ctx),
    ...assembleSessionControl(ctx),
    ...assembleNativeInteractions(ctx),
    ...assembleProjects(ctx),
    ...assembleArtifacts(ctx),
    ...assembleToolLibrary(ctx),
    ...assembleSkillLibrary(ctx),
    ...assembleThemes(ctx),
    ...assembleMemories(ctx),
    ...assemblePluginConfiguration(ctx),
    ...assembleCollectionEvents(ctx),
    close: close.bind(undefined, ctx),
    kernelExecutionGet: kernelExecutionGet.bind(undefined, ctx),
    kernelExecutionSet: kernelExecutionSet.bind(undefined, ctx),
    toolTitleGet: toolTitleGet.bind(undefined, ctx),
    toolTitleSet: toolTitleSet.bind(undefined, ctx),
    soulGet: soulGet.bind(undefined, ctx),
    soulSave: soulSave.bind(undefined, ctx),
  };
  return ctx;
}
