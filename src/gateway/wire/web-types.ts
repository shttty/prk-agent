// The only src/ file web/ may import, and only with `import type` (enforced by web's eslint config): the wire and
// snapshot shapes the browser receives. Declare a shape by re-exporting it from the subsystem that owns it; never
// copy it into web/. web/tsconfig.json type-checks every src file these re-exports reach.
// Grouped by source module (alphabetical by path); each type is exported once, whichever web directory uses it.

export type { PeerDelivery, PeerMessage } from "../../../shared/session-messages/message-types.ts";
export type { ThemeDocument, ThemeEntry, ThemeImport, ThemeLibrary, ThemePreview, ThemeWarning } from "../../../shared/themes.ts";
export type { ConfigurationIssue } from "../../config/execution-target/configuration-issue.ts";
export type { ArchiveGroup, ArchivePreview, ArchivePreviewSession, ArchivedSession, ProjectArchivePreview, ProjectArchiveResult } from "../archives/archive-types.ts";
export type { TargetEnvironmentSnapshot } from "../instance-environments/environment-types.ts";
export type { AbsoluteListing, EditableExecutionTarget, InspectTargetResult, PublicExecutionTarget, TargetConnection } from "../instances/instance-types.ts";
export type { ModelCatalog } from "../models/model-types.ts";
export type { CreatedSession, RecoverSessionRequest, SessionSnapshot, WorkbenchSnapshot } from "../session-views/session-view-types.ts";
export type { ToolContent, ToolContentPreview } from "../tool-content/content-types.ts";
export type { NativeActionResult } from "./wire-types.ts";
export type { KernelSnapshot } from "../../kernel/kernel-types.ts";
export type { MetricView } from "../../monitor/custom-metrics/custom-metrics-types.ts";
export type { MonitorHistory } from "../../monitor/sample-history/sample-history-types.ts";
export type { SessionChanges, SessionMonitor } from "../../monitor/session-monitor/session-monitor-types.ts";
export type { MonitoredProcess } from "../../monitor/telemetry/process-types.ts";
export type { MachineSample, RemoteHostMonitor } from "../../monitor/telemetry/telemetry-types.ts";
export type { AskQuestion } from "../../plugins/ask/tools/ask-types.ts";
export type { DerivedSessionInfo } from "../../plugins/sessions/session-types.ts";
export type { ManagedSessionSnapshot, SessionRecovery, SessionState } from "../../sessions/collection/collection-types.ts";
export type { HostedExtensionUiSnapshot, HostedNode } from "../../sessions/extension-ui/ui-types.ts";
export type { SessionReadIssue } from "../../sessions/history/history-types.ts";
export type { KernelCellDelivery } from "../../sessions/history/kernel-cells/delivery-types.ts";
export type { HostState, SessionHostEvent, SessionHostSnapshot } from "../../sessions/host/host-types.ts";
export type { HostOperationSnapshot, OperationCompletion } from "../../sessions/host/operations/operation-types.ts";
export type { MemoryChange } from "../../sessions/memory/memory-types.ts";
export type { NativeCatalog, NativeReferenceCandidate } from "../../sessions/native-interaction/native-types.ts";
export type { SessionControl } from "../../sessions/session-control/control-types.ts";
