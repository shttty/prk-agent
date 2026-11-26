// The only src/ file web/ may import, and only with `import type` (enforced by web's eslint config): the wire and
// snapshot shapes the browser receives. Declare a shape by re-exporting it from the subsystem that owns it; never
// copy it into web/. web/tsconfig.json type-checks every src file these re-exports reach.

// Shared by several web directories
export type { PublicExecutionTarget } from "../instances/instance-types.ts";
export type { KernelSnapshot } from "../../kernel/kernel-types.ts";
export type { ManagedSessionSnapshot } from "../../sessions/collection/collection-types.ts";
export type { SessionSnapshot, WorkbenchSnapshot } from "../session-views/session-view-types.ts";
export type { PeerDelivery, PeerMessage } from "../../../shared/session-messages/message-types.ts";
export type { ThemeDocument, ThemeEntry, ThemeImport, ThemeLibrary, ThemePreview, ThemeWarning } from "../../../shared/themes.ts";

// web/workbench
export type { SessionState, SessionRecovery } from "../../sessions/collection/collection-types.ts";
export type { CreatedSession, RecoverSessionRequest } from "../session-views/session-view-types.ts";
export type { SessionHostSnapshot, SessionHostEvent, HostState } from "../../sessions/host/host-types.ts";
export type { OperationCompletion, HostOperationSnapshot } from "../../sessions/host/operations/operation-types.ts";
export type { HostedExtensionUiSnapshot } from "../../sessions/extension-ui/ui-types.ts";
export type { NativeCatalog, NativeReferenceCandidate } from "../../sessions/native-interaction/native-types.ts";
export type { NativeActionResult } from "./wire-types.ts";
export type { ToolContent, ToolContentPreview } from "../tool-content/content-types.ts";
export type { ModelCatalog } from "../models/model-types.ts";
export type { ArchiveGroup, ArchivedSession, ArchivePreview, ProjectArchivePreview, ProjectArchiveResult } from "../archives/archive-types.ts";
export type { SessionControl } from "../../sessions/session-control/control-types.ts";
export type { SessionReadIssue } from "../../sessions/history/history-types.ts";
export type { SessionMonitor } from "../../monitor/session-monitor/session-monitor-types.ts";
export type { TargetEnvironmentSnapshot } from "../instance-environments/environment-types.ts";
export type { AbsoluteListing, EditableExecutionTarget, InspectTargetResult, TargetConnection } from "../instances/instance-types.ts";


// web/instances, web/monitor, web/sessions


// web/settings, web/shell, web/workspace


// web/chat
