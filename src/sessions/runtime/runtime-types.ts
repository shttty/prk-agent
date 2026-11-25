import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { OperationCompletionObserver, SessionHost } from "../host/host-types.ts";
import type { HostedExtensionUI } from "../extension-ui/ui-types.ts";
import type { SessionOptions } from "../../config/session/session-options.ts";
import type { ToolMode } from "../../config/session/session-options.ts";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";
import type { KernelRuntimeOptions, KernelExecutionPolicy } from "../../kernel/kernel-options.ts";
import type { TargetEnvironments } from "../../target-environment/connection/connection-types.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";
import type { TraceOptions } from "../../config/trace/trace-options.ts";
import type { NamespaceOptions } from "../../config/namespace/namespace-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { KernelModuleConfig } from "../../codemode/module-payload/module-types.ts";
import type { CodeModeOptions } from "../../config/codemode/codemode-options.ts";
import type { ExtensionFilter } from "../../config/extensions/extensions-options.ts";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";
import type { SkillLibrary } from "../skill-library/skill-types.ts";
import type { LearningOptions } from "../../config/learning/learning-options.ts";
import type { MemoryStore } from "../memory/memory-types.ts";
import type { PluginConfigStore } from "../plugin-config/config-types.ts";
import type { MemoryOptions } from "../../config/memory/memory-options.ts";
import type { ModelTerminals } from "../../workspace/model-terminals/model-terminals-types.ts";
import type { TargetFileContext } from "../../workspace/target-files/files-types.ts";
import type { CapabilityCatalog, CapabilityChange } from "../../config/capabilities/capability-types.ts";
import type { CapabilityEntry } from "../../config/capabilities/capability-types.ts";
import type { CapabilitySwitches } from "../../config/capabilities/capability-types.ts";
import type { TargetChannels } from "../../target-channel/channels/channel-types.ts";
import type { TerminalOptions } from "../../config/terminal/terminal-options.ts";
import type { RemoteExtensionLoadInput, RemotePackageConfiguration } from "../../remote-extensions/session-load/load-types.ts";
import type { KernelLanguage, KernelLanguageChange, KernelObservationSource } from "../../kernel/kernel-types.ts";
import type { SessionsGateway } from "../../plugins/sessions/gateway-types.ts";
import type { ModelProviderOwnership } from "../model-providers/provider-types.ts";
import type { PythonToolClient, PythonToolHooks } from "../../kernel/kernel-types.ts";
import type { PythonEnvironmentPolicy } from "../../target-environment/python/resolve-python-runtime.ts";


export interface SessionRuntimeDependencies {
  /** Owned integration fixtures inject the complete kernel client, never SDK execution. */
  readonly createKernel?: (hooks: PythonToolHooks) => PythonToolClient;
  readonly model: NonNullable<AgentSession["model"]>;
  readonly modelRuntime: ModelRuntime;
  readonly modelProviders?: ModelProviderOwnership;
  readonly thinkingLevel: AgentSession["thinkingLevel"];
  readonly autoCompaction?: boolean;
  readonly autoRetry?: boolean;
  readonly scopedModels?: readonly string[];
  readonly sessions?: SessionsGateway;
  readonly roleInstructions?: string;
  readonly cwd: string;
  readonly agentDir: string;
  readonly sessionManager?: SessionManager;
  readonly sessionOptions?: SessionOptions;
  readonly learningOptions?: LearningOptions;
  readonly extensionFilter?: ExtensionFilter;
  readonly pluginFailures?: ReadonlyMap<string, string>;
  readonly kernelRuntimeOptions?: Partial<KernelRuntimeOptions>;
  readonly kernelExecutionPolicy?: () => KernelExecutionPolicy;
  readonly toolTitle?: () => boolean;
  readonly targetEnvironments?: TargetEnvironments;
  readonly pythonEnvironment?: PythonEnvironmentPolicy;
  readonly processWindow?: ProcessWindowLimits;
  readonly terminalOptions?: TerminalOptions;
  readonly traceOptions?: TraceOptions;
  readonly codemodeOptions?: CodeModeOptions;
  readonly targetCacheRoot?: string;
  readonly namespaceOptions?: NamespaceOptions;
  readonly kernelModuleConfig?: KernelModuleConfig;
  readonly limits?: LimitsOptions;
  readonly toolLibrary?: ToolLibrary;
  readonly skillLibrary?: SkillLibrary;
  readonly memoryStore?: MemoryStore;
  readonly memoryOptions?: MemoryOptions;
  readonly pluginConfig?: PluginConfigStore;
  readonly modelTerminals?: (context: TargetFileContext) => ModelTerminals;
  readonly capabilityDefaults?: (instance: string) => { capabilities: CapabilitySwitches; localTools: boolean };
  /** Instance then global maps; lazy resolves each layer before falling through. */
  readonly capabilityLayers?: (instance: string) => readonly CapabilitySwitches[];
  readonly globalCapabilityCatalog?: () => CapabilityCatalog;
  readonly onOperationCompletion?: OperationCompletionObserver;
  readonly onKernelFailure?: PythonToolHooks["onFailure"];
  readonly onCapabilityCatalog?: (catalog: CapabilityCatalog) => void;
  readonly targetChannels?: TargetChannels;
  readonly requireEnvironment?: (target: string) => Promise<void>;
  readonly remoteExtensions?: (instance: string) => RemotePackageConfiguration;
  readonly remoteExtensionOptions?: Omit<RemoteExtensionLoadInput, "target" | "sessionId" | "packages" | "projectTrusted" | "nativeTools">;
  readonly projectId?: () => string | undefined;
  /** Display name of the session's project, registered with its shared project memory. */
  readonly projectName?: () => string | undefined;
}

export interface SessionRuntime {
  /** The fixed SDK conversation owned by this runtime. */
  readonly session: AgentSession;
  readonly host: SessionHost;
  readonly extensionUi: HostedExtensionUI;
  readonly kernel: KernelObservationSource;
  readonly toolMode: ToolMode;
  setToolMode(mode: ToolMode): void;
  setKernelLanguage?(language: KernelLanguage): Promise<KernelLanguageChange>;
  readonly delegation: DelegationLevel;
  setDelegation(level: DelegationLevel): void;
  readonly localTools: boolean;
  setLocalTools(enabled: boolean): void;
  capabilityCatalog(): CapabilityCatalog;
  setCapabilities(changes: readonly CapabilityChange[]): void;
  refreshCapabilities(): void;
  refreshToolDeclarations(): void;
  refreshRegistration(): Promise<void>;
  readonly requiresReload: boolean;
  reload(): Promise<void>;
  readonly terminalActive: boolean;
  close(): Promise<void>;
}

export type CapabilityMetadata = Omit<CapabilityEntry, "enabled" | "configured" | "defaultEnabled" | "overridden" | "groupEnabled">;

export type RuntimeResourceOptions = NonNullable<Parameters<typeof createAgentSessionServices>[0]["resourceLoaderOptions"]>;

export interface RuntimeConversation {
  session: AgentSession;
  host: SessionHost;
  extensionUi: HostedExtensionUI;
  loadedProject?: { readonly id: string; readonly name: string | undefined };
}
