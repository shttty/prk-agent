import type { AgentSession, LoadSkillsResult, ModelRuntime, ToolDefinition, ToolInfo } from "@earendil-works/pi-coding-agent";
import type { PrkConfig } from "../../config/document/document-types.ts";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";
import type { ToolLibraryEntry } from "../../codemode/tool-library/library-types.ts";
import type { SkillLibrary } from "../skill-library/skill-types.ts";
import type { SkillLibraryEntry } from "../skill-library/skill-types.ts";
import type { ExtensionHandlerScope } from "../extension-invocation/invocation-types.ts";
import type { RemoteExtensionLoad, RemoteExtensionLoadInput } from "../../remote-extensions/session-load/load-types.ts";
import type { SessionsGateway } from "../../plugins/sessions/gateway-types.ts";
import type { MemoryStore } from "../memory/memory-types.ts";
import type { PluginConfigStore } from "../plugin-config/config-types.ts";
import type { ModelProviderOwnership, ProviderPolicyError } from "../model-providers/provider-types.ts";

export type ToolMetadata = Pick<ToolDefinition, "name" | "description" | "exposure">;
export type CatalogTool = ToolMetadata & Pick<ToolInfo, "sourceInfo" | "namespace">;

export interface GatewayCapabilityCatalogInput {
  readonly cwd: string;
  readonly agentDir: string;
  readonly modelRuntime: ModelRuntime;
  readonly modelProviders?: ModelProviderOwnership;
  readonly model: AgentSession["model"];
  readonly config: PrkConfig;
  readonly extensionPaths?: readonly string[];
  readonly skillLibrary: SkillLibrary;
  readonly toolLibrary: ToolLibrary;
  readonly sessions: SessionsGateway;
  readonly memoryStore: MemoryStore;
  readonly pluginConfig: PluginConfigStore;
  readonly remoteExtensions?: Omit<RemoteExtensionLoadInput, "projectTrusted">;
  readonly signal?: AbortSignal;
  readonly onPluginCommands?: (packages: Array<{ source: string; commands: Array<{ name: string; description?: string }> }>) => void;
  readonly pluginWarnings?: Map<string, Set<string>>;
  readonly pluginFailures?: Map<string, string>;
}

export interface CollectedCatalogMetadata {
  saved: ToolLibraryEntry[];
  sharedSkills: SkillLibraryEntry[];
  sharedPaths: Set<string>;
  skills: LoadSkillsResult;
  tools: Map<string, CatalogTool>;
}

export interface CatalogContext {
  input: GatewayCapabilityCatalogInput;
  extensionHandlers: ExtensionHandlerScope;
  nativeTools: ToolDefinition[];
  nativeNames: Set<string>;
  failures: string[];
  pluginFailures: Map<string, string>;
  providerErrors?: ProviderPolicyError[];
  remoteLoad?: RemoteExtensionLoad;
  closing?: boolean;
}
