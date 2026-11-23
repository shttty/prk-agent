import type { Extension, ExtensionFactory, ToolInfo } from "@earendil-works/pi-coding-agent";
import type { ArtifactStore } from "../../artifacts/store/assemble-store.ts";
import type { TargetChannels, TargetEvent } from "../../target-channel/channels/channel-types.ts";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { RemoteExtensionArtifactSource } from "../deployment/deployment-types.ts";
import type { RemoteExtensionGeneration, RemoteExtensionOptions } from "../generation/generation-types.ts";
import type { RemoteExtensionStatus } from "../packages/package-types.ts";
import type { HostPluginPackage } from "../../plugins/packages/package-types.ts";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";

export interface RemoteExtensionContext { instance: string; package: string; sessionId?: string }
export interface RemoteExtensionObservers {
  onRemoteExtensionEvent?(event: TargetEvent & RemoteExtensionContext): void;
  onRemoteExtensionGeneration?(generation: RemoteExtensionGeneration, context: RemoteExtensionContext): void;
}
export interface RemotePackageConfiguration {
  packages: HostPluginPackage[];
  packageErrors?: readonly RemoteExtensionStatus[];
}
export interface RemoteExtensionLoadInput extends RemoteExtensionObservers {
  target: ExecutionTarget;
  sessionId?: string;
  channels: TargetChannels;
  storeDir: string;
  store?: ArtifactStore;
  nativeTools: boolean;
  packages: readonly HostPluginPackage[];
  packageErrors?: readonly RemoteExtensionStatus[];
  projectExtensions?: string[];
  providerOwnerIds?: readonly string[];
  projectTrusted: () => boolean;
  hostOptions?: RemoteExtensionOptions["hostOptions"];
  binChunkBytes?: number;
  env?: RemoteExtensionOptions["env"];
  onFrozen?: RemoteExtensionOptions["onFrozen"];
  mapNativeTool?: RemoteExtensionOptions["mapNativeTool"];
  telemetryIntervalMs?: number;
  onMonitor?: RemoteExtensionOptions["onMonitor"];
  onStatus?(status: RemoteExtensionStatus[]): void;
}

export interface RemoteExtensionLoad {
  paths: string[];
  readonly providerErrors: readonly ProviderPolicyError[];
  factories: Array<{ name: string; factory: ExtensionFactory }>;
  inspect(extensions: readonly Extension[], errors: readonly { path: string; error: string }[]): Array<{ path: string; error: string }>;
  origin(tool: Pick<ToolInfo, "name">): { group: string; groupLabel: string; source: string; instance: string; location: "local" | "target" } | undefined;
  close(): Promise<void>;
}
export interface LoadContext {
  input: RemoteExtensionLoadInput;
  load: RemoteExtensionLoad;
  generations: RemoteExtensionGeneration[];
  statuses: RemoteExtensionStatus[];
  tools: Map<string, RemoteExtensionStatus>;
  localEntries: Map<string, RemoteExtensionStatus>;
  managedErrors: Map<string, RemoteExtensionStatus>;
  nativeStatus?: RemoteExtensionStatus;
  remotePackages: RemoteExtensionOptions["packages"];
  remoteStatuses: Map<string, RemoteExtensionStatus>;
  projectEntries: Map<string, string>;
}

export type ExtensionCatalog = Required<Pick<RemoteExtensionStatus, "tools" | "commands">>;
