import type { WorkbenchSnapshot } from "../session-views/session-view-types.ts";
import type { ModelCatalog } from "../models/model-types.ts";
import type { CapabilitySettings } from "../../config/capabilities/capability-types.ts";
import type { CapabilitySettingsChange } from "../../config/capabilities/capability-types.ts";
import type { PluginList, PluginChange, PluginInstall, PluginUninstall } from "../../plugins/packages/package-types.ts";
import type { ArtifactManifest } from "../../artifacts/store/store-types.ts";
import type { ArtifactUploadRequest } from "../../artifacts/store/store-types.ts";
import type { ToolLibraryEntry } from "../../codemode/tool-library/library-types.ts";
import type { ToolLibraryAction } from "../../codemode/tool-library/library-types.ts";
import type { SkillLibraryEntry } from "../../sessions/skill-library/skill-types.ts";
import type { ThemeLibrary } from "../../../shared/themes.ts";
import type { ThemePreview } from "../../../shared/themes.ts";
import type { ThemeImport } from "../../../shared/themes.ts";
import type { MemoryListing } from "../../sessions/memory/memory-types.ts";
import type { LayerConfigFile, LayerConfigView } from "../../sessions/memory/layers/read-layer-config.ts";
import type { PluginConfigView } from "../../sessions/plugin-config/config-types.ts";
import type { PluginConfigSection } from "../../sessions/plugin-config/config-types.ts";
import type { EditableExecutionTarget } from "../instances/instance-types.ts";
import type { ExecutionTargetConfig } from "../../config/execution-target/target-types.ts";
import type { ExecutionTargetEdit } from "../../config/execution-target/target-types.ts";
import type { TargetConnection } from "../instances/instance-types.ts";
import type { InspectTargetResult, AbsoluteListing } from "../instances/instance-types.ts";
import type { CreatedSession } from "../session-views/session-view-types.ts";
import type { BranchHistoryPage, HistoryPageCursor } from "../../sessions/history/history-types.ts";
import type { ToolContent } from "../tool-content/content-types.ts";
import type { CapturedBody, PromptMessagesPart, PromptPartRequest, PromptReport, PromptToolsPart } from "../../sessions/prompt-capture/capture-types.ts";
import type { KernelResultView } from "../session-views/history/kernel-result-types.ts";
import type { SessionManagementRequest } from "../../sessions/derivation/derivation-types.ts";
import type { SessionSnapshot } from "../session-views/session-view-types.ts";
import type { ArchivePreview, ProjectArchivePreview, ProjectArchiveResult } from "../archives/archive-types.ts";
import type { RecoverSessionRequest } from "../session-views/session-view-types.ts";
import type { KernelSnapshot } from "../../kernel/kernel-types.ts";
import type { MonitorHistory } from "../../monitor/sample-history/sample-history-types.ts";
import type { FileDiff } from "../../monitor/session-monitor/session-monitor-types.ts";
import type { SessionHostSnapshot } from "../../sessions/host/host-types.ts";
import type { SessionHost } from "../../sessions/host/host-types.ts";
import type { NamespaceSummary } from "../../codemode/kernel-protocol/kernel-protocol-types.ts";
import type { NativeCatalog } from "../../sessions/native-interaction/native-types.ts";
import type { NativeActionRequest } from "../wire/wire-types.ts";
import type { NativeActionResult } from "../wire/wire-types.ts";
import type { ExtendedSendRequest } from "../wire/wire-types.ts";
import type { SendStatus } from "../native-interactions/send-records/send-record-types.ts";
import type { WorkspaceMethod } from "../../workspace/requests/requests-types.ts";
import type { TerminalEvent } from "../../workspace/terminals/terminals-types.ts";
import type { TerminalSnapshot } from "../../workspace/terminals/terminals-types.ts";
import type { GatewayCollectionEvent, TargetEnvironmentSnapshot } from "../instance-environments/environment-types.ts";
import type { PrkConfig } from "../../config/document/document-types.ts";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import type { DerivationConfig } from "../../config/derivation/derivation-types.ts";
import type { DerivationSettings } from "../../config/derivation/derivation-types.ts";
import type { RemoteExtensionObservers } from "../../remote-extensions/session-load/load-types.ts";
import type { SessionRuntimeDependencies } from "../../sessions/runtime/runtime-types.ts";
import { createSessionCollection } from "../../sessions/collection/assemble-collection.ts";
import type { SessionControl } from "../../sessions/session-control/control-types.ts";
import type { ProjectAssignment, ProjectSelection } from "../projects/project-types.ts";
import type { KernelExecutionSettings } from "../../config/kernel/kernel-options.ts";
import type { BunPackagePins } from "../../config/execution-target/validation/bun-package-options.ts";
import type { ToolTitleSettings } from "../../config/session/session-options.ts";
import type { SoulView } from "../soul/read-soul-settings.ts";
import type { MetricsSettings } from "../../config/metrics/metrics-options.ts";
import type { MetricsView } from "../metrics/read-settings.ts";

export interface GatewaySessionHost {
  workbench(): WorkbenchSnapshot;
  sessionControl(): SessionControl;
  setSessionRoot(request: { readonly sessionId: string }): SessionControl;
  setProjectSupervisor(request: { readonly sessionId: string }): SessionControl;
 modelCatalog(): Promise<ModelCatalog>;
  reloadTargets(): Promise<WorkbenchSnapshot>;
  getTargetEnvironment(request: { target: string }): TargetEnvironmentSnapshot;
  deployTargetEnvironment(request: { target: string; bunPackages?: BunPackagePins }): TargetEnvironmentSnapshot;
  derivationGet(): DerivationSettings;
  derivationSet(request: { readonly derivation: DerivationConfig }): Promise<DerivationSettings>;
  kernelExecutionGet(): KernelExecutionSettings;
  kernelExecutionSet(request: KernelExecutionSettings): Promise<KernelExecutionSettings>;
  toolTitleGet(): ToolTitleSettings;
  toolTitleSet(request: ToolTitleSettings): Promise<ToolTitleSettings>;
  soulGet(): SoulView;
  soulSave(request: { content: string; revision: string }): SoulView;
  metricsGet(): MetricsView;
  metricsSet(request: MetricsSettings): Promise<MetricsView>;
  capabilitiesList(instance?: string): Promise<CapabilitySettings>;
  capabilitiesRefresh(instance?: string): Promise<CapabilitySettings>;
  capabilitiesChange(request: CapabilitySettingsChange): Promise<CapabilitySettings>;
  pluginsList(): Promise<PluginList>;
  pluginsChange(request: PluginChange): Promise<PluginList>;
  pluginsInstall(request: PluginInstall): Promise<PluginList>;
  pluginsUninstall(request: PluginUninstall): Promise<PluginList>;
  artifactsList(): ArtifactManifest;
  artifactsUpload(request: ArtifactUploadRequest): Promise<ArtifactManifest>;
  artifactsCurrent(name: string, version: string): Promise<ArtifactManifest>;
  artifactsDelete(name: string, version: string): Promise<ArtifactManifest>;
  toolsList(target?: string): { tools: ToolLibraryEntry[] };
  toolsChange(action: ToolLibraryAction, name: string): { tools: ToolLibraryEntry[] };
  skillsList(): { skills: SkillLibraryEntry[] };
  skillsChange(action: ToolLibraryAction, name: string): { skills: SkillLibraryEntry[] };
  skillsScope(name: string, scope: string): { skills: SkillLibraryEntry[] };
  themesList(): ThemeLibrary;
  themesPreview(theme: unknown): ThemePreview;
  themesImport(theme: unknown): ThemeImport;
  themesDelete(id: string): ThemeLibrary;
  memoryList(): MemoryListing;
  memoryChange(request: Record<string, unknown>): MemoryListing;
  memoryDeleteInstance(instance: string): MemoryListing;
  memoryConfigGet(file: LayerConfigFile): LayerConfigView;
  memoryConfigSave(request: { file: LayerConfigFile; document: Record<string, unknown>; hash: string }): LayerConfigView;
  pluginConfigGet(provider: string): PluginConfigView;
  pluginConfigSet(request: { provider: string; file: string; sections?: PluginConfigSection[] }): PluginConfigView;
  pluginConfigWrite(request: { provider: string; changes: { key: string; value: unknown }[] }): PluginConfigView;
  getTarget(id: string): EditableExecutionTarget;
  addTarget(request: { readonly target: ExecutionTargetConfig }): Promise<WorkbenchSnapshot>;
  editTarget(request: { readonly target: ExecutionTargetEdit }): Promise<WorkbenchSnapshot>;
  deleteTarget(request: { readonly target: string; readonly confirm: true }): Promise<WorkbenchSnapshot>;
  inspectTarget(request: { readonly connection: TargetConnection }): Promise<InspectTargetResult>;
  browseTarget(request: { readonly connection: TargetConnection; readonly path: string }): Promise<AbsoluteListing>;
  assignProject(sessionId: string, project: ProjectAssignment | null): SessionSnapshot;
  renameProject(projectId: string, name: string): { readonly ok: true };
  createSession(request: { readonly target: string; readonly label?: string; readonly cwd?: string; readonly project?: ProjectSelection }): Promise<CreatedSession>;
  history(sessionId: string): CreatedSession & { readonly readOnly: true };
  historyPage(sessionId: string, cursor: HistoryPageCursor): BranchHistoryPage;
  toolContent(sessionId: string, toolCallId: string): ToolContent;
  /** The session runtime's last provider request (docs/wire/sessions.md#prompt). */
  sessionPrompt(sessionId: string): { readonly sessionId: string } & PromptReport;
  /** One whole part of that request (docs/wire/sessions.md#prompt); `NOT_FOUND` when the runtime has none. */
  sessionPromptPart(sessionId: string, request: PromptPartRequest): { readonly sessionId: string } & (PromptToolsPart | PromptMessagesPart | CapturedBody);
  kernelResult(sessionId: string, cellId: string, imageIndex?: number): KernelResultView;
  manageSession(sessionId: string, request: SessionManagementRequest): Promise<{ readonly ok: true }>;
  renameSession(sessionId: string, label: string): Promise<SessionSnapshot>;
  /** Archive the session and the children it owns: stop them, release their resources, keep their history. */
  archiveSession(sessionId: string, request: { readonly confirm: true }): Promise<void>;
  archivePreview(sessionId: string): ArchivePreview;
  archiveProjectPreview(projectId: string): ProjectArchivePreview;
  archiveProject(projectId: string, request: { readonly confirm: true }): Promise<ProjectArchiveResult>;
  unarchive(group: string): Promise<{ readonly ok: true }>;
  /** Permanently delete an archive group's SDK files. */
  purgeArchive(group: string, request: { readonly confirm: true }): Promise<{ readonly ok: true }>;
  recoverSession(sessionId: string, request: RecoverSessionRequest): Promise<CreatedSession>;
  /** Wake a sleeping session ahead of input (e.g. when it is opened). No-op when it is not sleeping. */
  wakeSession(sessionId: string): Promise<{ readonly sessionId: string; readonly sleeping: boolean }>;
  kernelClear(sessionId: string): Promise<KernelSnapshot>;
  kernelRestart(sessionId: string): Promise<KernelSnapshot>;
  /** `leaseMs`: how long an open card keeps the fast cadence; the browser repeats the request well inside it. */
  monitorFocus(sessionId: string, open: boolean): { readonly focused: boolean; readonly leaseMs: number };
  monitorHistory(sessionId: string): MonitorHistory;
  monitorDiff(sessionId: string, path: string): Promise<FileDiff>;
  state(sessionId: string): SessionHostSnapshot & { readonly projectId?: string; readonly projectName?: string };
  session(sessionId: string): SessionHost;
  kernelVariables(sessionId: string): { variables: NamespaceSummary["variables"]; truncated: boolean };
  kernelDeleteVariable(sessionId: string, variable: string): Promise<KernelSnapshot>;
  nativeCapabilities(sessionId: string): NativeCatalog;
  nativeAction(sessionId: string, request: NativeActionRequest): Promise<NativeActionResult>;
  nativeSend(sessionId: string, request: ExtendedSendRequest): Promise<unknown>;
  /** What became of a send requestId; an unseen one is withdrawn (docs/wire/sessions.md#send-status). */
  sendStatus(sessionId: string, request: { readonly requestId: string; readonly streamId: string }): Promise<SendStatus>;
  workspace(method: WorkspaceMethod, sessionId: string, params: Record<string, unknown>): Promise<unknown>;
  subscribeTerminal(sessionId: string, terminal: string, listener: (event: TerminalEvent) => void): { snapshot: TerminalSnapshot; unsubscribe(): void };
  closeSession(sessionId: string): Promise<void>;
  subscribeSessions(listener: (event: GatewayCollectionEvent) => void): () => void;
  close(): Promise<void>;
}

export interface GatewayHostOptions {
  readonly cwd: string;
  readonly home?: string;
  readonly config?: PrkConfig;
  /** Dedicated SDK session directory; never supplied by a browser. */
  readonly historyDir?: string;
  readonly noSkills?: boolean;
  readonly extensionPaths?: readonly string[];
  /** Required PROVIDER/MODEL for every session; no fallback selection. */
  readonly model: string;
  readonly thinkingLevel?: AgentSession["thinkingLevel"];
  /** Explicit targets take precedence over instances.toml for controlled callers. */
  readonly targets?: readonly ExecutionTarget[];
  /** Bind the metrics listener at start (the Gateway process does; in-process hosts leave the port alone). `metricsSet` always applies. */
  readonly serveMetrics?: boolean;
  readonly derivation?: DerivationConfig;
}

export type ExecutionConfigDocument = Record<string, unknown> & { instances: unknown[] };

export interface GatewayHostDependencies extends RemoteExtensionObservers {
  /** Injection seam for controlled verification; production builds SDK services. */
  readonly runtimeDependencies?: SessionRuntimeDependencies;
  readonly collectionFactory?: typeof createSessionCollection;
}
