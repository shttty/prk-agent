import type { close } from "./lifecycle/close-host.ts";
import type { RemotePackagesMethods } from "../remote-packages/remote-packages-methods.ts";
import type { ModelsMethods } from "../models/models-methods.ts";
import type { WorkspaceMethods } from "../workspace/workspace-methods.ts";
import type { MonitoringMethods } from "../monitoring/monitoring-methods.ts";
import type { SessionViewsMethods } from "../session-views/session-views-methods.ts";
import type { ArchivesMethods } from "../archives/archives-methods.ts";
import type { CapabilitiesMethods } from "../capabilities/capabilities-methods.ts";
import type { SessionLifecycleMethods } from "../session-lifecycle/session-lifecycle-methods.ts";
import type { InstancesMethods } from "../instances/instances-methods.ts";
import type { DerivationMethods } from "../derivation/derivation-methods.ts";
import type { NativeInteractionsMethods } from "../native-interactions/native-interactions-methods.ts";
import type { ProjectsMethods } from "../projects/projects-methods.ts";
import type { ArtifactsMethods } from "../artifacts/artifacts-methods.ts";
import type { ToolLibraryMethods } from "../tool-library/tool-library-methods.ts";
import type { SkillLibraryMethods } from "../skill-library/skill-library-methods.ts";
import type { ThemesMethods } from "../themes/themes-methods.ts";
import type { MemoriesMethods } from "../memories/memories-methods.ts";
import type { PluginConfigurationMethods } from "../plugin-configuration/plugin-configuration-methods.ts";
import type { CollectionEventsMethods } from "../collection-events/collection-events-methods.ts";
import type { ControlMethods } from "../session-control/control-methods.ts";
import type { kernelExecutionGet } from "../kernel-execution/read-settings.ts";
import type { kernelExecutionSet } from "../kernel-execution/save-settings.ts";
import type { toolTitleGet } from "../tool-title/read-settings.ts";
import type { toolTitleSet } from "../tool-title/save-settings.ts";
import type { soulGet } from "../soul/read-soul-settings.ts";
import type { soulSave } from "../soul/save-soul.ts";
import type { metricsGet } from "../metrics/read-settings.ts";
import type { metricsSet } from "../metrics/save-settings.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface HostMethods {
  close: WithoutContext<typeof close>;
  kernelExecutionGet: WithoutContext<typeof kernelExecutionGet>;
  kernelExecutionSet: WithoutContext<typeof kernelExecutionSet>;
  toolTitleGet: WithoutContext<typeof toolTitleGet>;
  toolTitleSet: WithoutContext<typeof toolTitleSet>;
  soulGet: WithoutContext<typeof soulGet>;
  soulSave: WithoutContext<typeof soulSave>;
  metricsGet: WithoutContext<typeof metricsGet>;
  metricsSet: WithoutContext<typeof metricsSet>;
}

export interface GatewayMethods extends RemotePackagesMethods, ModelsMethods, WorkspaceMethods, MonitoringMethods, SessionViewsMethods, ArchivesMethods, CapabilitiesMethods, SessionLifecycleMethods, InstancesMethods, DerivationMethods, NativeInteractionsMethods, ProjectsMethods, ArtifactsMethods, ToolLibraryMethods, SkillLibraryMethods, ThemesMethods, MemoriesMethods, PluginConfigurationMethods, CollectionEventsMethods, ControlMethods, HostMethods {}
