import type { AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext, ExtensionFactory, ExtensionToolContext, SourceInfo, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { RemoteHostMonitor } from "../../monitor/telemetry/telemetry-types.ts";
import { DEFAULT_REMOTE_HOST_OPTIONS, type RemoteHostOptions } from "../../config/remote-host/remote-host-options.ts";
import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import type { TargetChannels, TargetEvent } from "../../target-channel/channels/channel-types.ts";
import type { RemoteExtensionArtifactSource } from "../deployment/deployment-types.ts";
import type { KernelMemory } from "../../codemode/kernel-protocol/kernel-protocol-types.ts";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";
export interface RemoteExtensionOptions {
  channels: TargetChannels;
  machine: string;
  storeDir: string;
  artifacts: RemoteExtensionArtifactSource;
  nativeTools: boolean;
  cwd: string;
  projectTrusted: boolean;
  packages: Array<{ name: string; artifacts?: RemoteExtensionArtifactSource; extensions: string[] }>;
  projectExtensions?: string[];
  providerOwnerIds?: readonly string[];
  hostOptions?: RemoteHostOptions;
  env?: Record<string, string>;
  requestTimeoutMs?: number;
  binChunkBytes?: number;
  telemetryIntervalMs?: number;
  onMonitor?: (host: RemoteHostMonitor | null) => void;
  onEvent?: (event: TargetEvent) => void;
  onGeneration?: (host: RemoteExtensionGeneration) => void;
  onProviderError?: () => void;
  /** Track the transport lease even when the native-only executor has not started. */
  onCreated?: (host: RemoteExtensionGeneration) => void;
  /** Project-owned native/file dispatch; receives the target execute stub, never a local executor. */
  mapNativeTool?: (tool: ToolDefinition) => ToolDefinition;
  onError?: (error: Error) => void;
  onFrozen?: (host: RemoteExtensionGeneration) => Promise<void>;
}
export interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  method: string;
  abort(reason: Error): void;
  ctx?: ExtensionToolContext;
  signal?: AbortSignal;
  update?: AgentToolUpdateCallback;
  userWait(start: boolean): void;
}
export interface Frame {
  kind: string;
  id: string;
  method?: string;
  parentId?: string;
  payload?: unknown;
  result?: unknown;
  error?: unknown;
  reason?: unknown;
}
export interface Registration {
  tools: Array<Omit<ToolDefinition, "execute"> & { toolId: string; piNativeTool?: true }>;
  handlers: Array<{ event: string; handlerId: string }>;
  commands: Array<{ name: string; description?: string }>;
  pid: number;
  rootPid: number;
  packages: Array<{ name: string; tools: Registration["tools"]; commands: Registration["commands"]; sourceInfo?: SourceInfo; error?: string; errorCode?: string; errorDetails?: Record<string, unknown>; providerErrors?: ProviderPolicyError[] }>;
}

export interface RemoteExtensionGeneration {
  readonly generation: string;
  readonly lease: TargetLease;
  registration?: Registration;
  start(): Promise<Registration>;
  register(pi: ExtensionAPI, registration: Registration): void;
  close(reason?: string): Promise<void>;
}
export interface GenerationContext extends RemoteExtensionGeneration {
  pending: Map<string, Pending>;
  abortAcks: Map<string, NodeJS.Timeout>;
  reverse: Map<string, AbortController>;
  serial: number;
  revision: number;
  live: boolean;
  sendingFrame?: Promise<void>;
  incomingFrame?: { buffer: Buffer; offset: number };
  failure?: Error;
  closing?: Promise<void>;
  startPromise?: Promise<Registration>;
  unsubscribers: Array<() => void>;
  options: RemoteExtensionOptions;
  context?: ExtensionContext;
  memory?: KernelMemory;
  scoped?: boolean;
  memoryAt?: number;
}

export interface RequestContext {
  generation: GenerationContext;
  id: string;
  method: string;
  hooks: { ctx?: ExtensionToolContext; signal?: AbortSignal; update?: AgentToolUpdateCallback };
  result: PromiseWithResolvers<unknown>;
  timer?: NodeJS.Timeout;
  userWaits: number;
  onAbort(): void;
}
