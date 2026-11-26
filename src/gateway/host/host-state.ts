import type { TargetEnvironments } from "../../target-environment/connection/connection-types.ts";
import type { GatewayHostOptions } from "./host-types.ts";
import type { GatewayHostDependencies } from "./host-types.ts";
import type { initializePrkHome } from "../../config/home/initialize-prk-home.ts";
import type { PrkConfig } from "../../config/document/document-types.ts";
import type { ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";
import type { SkillLibrary } from "../../sessions/skill-library/assemble-skill-library.ts";
import type { MemoryStore } from "../../sessions/memory/assemble-memory.ts";
import type { PluginConfigStore } from "../../sessions/plugin-config/assemble-plugin-config.ts";
import type { ThemeStore } from "../themes/assemble-theme-store.ts";
import type { createSessionHistory } from "../../sessions/history/assemble-history.ts";
import type { createSessionCollection } from "../../sessions/collection/assemble-collection.ts";
import type { createTargetChannels } from "../../target-channel/channels/assemble-channels.ts";
import type { PackageState } from "../remote-packages/package-state.ts";
import type { CapabilityState } from "../capabilities/capability-state.ts";
import type { WorkspaceState } from "../workspace/workspace-state.ts";
import type { DerivationState } from "../derivation/derivation-state.ts";
import type { LifecycleState } from "../session-lifecycle/lifecycle-state.ts";
import type { InstanceState } from "../instances/instance-state.ts";
import type { ModelState } from "../models/model-state.ts";
import type { SessionHostsState } from "../session-hosts/host-binding-state.ts";
import type { ViewState } from "../session-views/view-state.ts";
import type { InteractionState } from "../native-interactions/interaction-state.ts";
import type { EventState } from "../collection-events/event-state.ts";
import type { MonitorState } from "../monitoring/monitor-state.ts";
import type { MetricsState } from "../metrics/metrics-state.ts";
import type { MessageState } from "../peer-messages/message-state.ts";
import type { GatewayMethods } from "./host-methods.ts";
import type { ControlState } from "../session-control/control-state.ts";
import type { GatewaySessionHost } from "./host-types.ts";

export interface HostState {
  options: GatewayHostOptions;
  dependencies: GatewayHostDependencies;
  paths: ReturnType<typeof initializePrkHome>;
  config: PrkConfig;
  artifactStore: ArtifactStore;
  toolLibrary: ToolLibrary;
  skillLibrary: SkillLibrary;
  memoryStore: MemoryStore;
  projectDates: Map<string, string | undefined>;
  pluginConfig: PluginConfigStore;
  themes: ThemeStore;
  historyDirectory: string;
  history: Awaited<ReturnType<typeof createSessionHistory>>;
  factory: typeof createSessionCollection;
  collection: ReturnType<typeof createSessionCollection>;
  channels: ReturnType<typeof createTargetChannels>;
  environments: TargetEnvironments;
}

/** One original Gateway host closure; fields are initialized in their original order. */
export interface HostContext {
  host: HostState;
  packages: PackageState;
  capabilities: CapabilityState;
  workspace: WorkspaceState;
  derivation: DerivationState;
  control: ControlState;
  lifecycle: LifecycleState;
  instances: InstanceState;
  models: ModelState;
  sessionHosts: SessionHostsState;
  views: ViewState;
  native: InteractionState;
  events: EventState;
  monitoring: MonitorState;
  metrics: MetricsState;
  peerMessages: MessageState;
  methods: GatewayMethods;
  api: GatewaySessionHost;
}
