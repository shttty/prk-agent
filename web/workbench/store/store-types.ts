import type {
  ArchiveGroup, ArchivedSession, HostedExtensionUiSnapshot, ModelCatalog, NativeActionResult, NativeCatalog, NativeReferenceCandidate, OperationCompletion,
  SessionControl, SessionHostSnapshot, SessionSnapshot, SessionState, ToolContent,
} from "../../../src/gateway/wire/web-types.ts";
import type { Presentation, StoredAttachment, StoredReference } from "../session-storage/session-storage-types.ts";
import type { ToolRun } from "../payloads/tool-runs/tool-run-types.ts";
import type { UnreadableSession } from "../payloads/payload-types.ts";
import type { StampedMonitor } from "../../monitor/readings/monitor-types.ts";
import type { ExtensionRender } from "./extension-ui/extension-render-types.ts";
import type { TargetRow } from "./targets/target-types.ts";

export type Tone = "notice" | "warning" | "error";

export type Loadable<T> = { value: T | null; loading: boolean; error: string | null };

/**
 * A session row of the list. `waking` and the flags are the page's own bookkeeping on top of the Gateway's row: `done`
 * marks a finished background session the user has not opened; the attention flags are set false by collection events.
 */
export type SessionRow = Omit<SessionSnapshot, "state" | "monitor" | "compacting" | "blocked" | "asking" | "stopped" | "retryPending" | "background"> & {
  state: SessionState | "waking";
  monitor?: StampedMonitor;
  compacting?: boolean;
  blocked?: boolean;
  asking?: boolean;
  stopped?: boolean;
  retryPending?: boolean;
  background?: boolean;
  done?: boolean;
};

/** An archived session shaped to read like a `SessionRow`: the live fields a stored session lacks stay empty. */
export type ArchivedRow = ArchivedSession & { state?: undefined; cwd?: undefined; derivation?: undefined; monitor?: undefined; kernel?: undefined; recovery?: undefined; requiresReload?: undefined; configurationIssue?: undefined };

/** The selected session's row: a listed one, or an archived one (read-only history). */
export type SelectedRow = SessionRow | ArchivedRow;

/** Read-only view of the session list for helpers that only look rows up. */
export type SessionRows = ReadonlyMap<string, SessionRow>;

export type BannerKind = "send-rejected" | "cancel-pending" | "recovery";

/** The one connection or outcome banner of the selected session; the tags tell pages which fact it reports. */
export type Banner = {
  text: string;
  tone: Tone;
  kind?: BannerKind;
  operationId?: string;
  connection?: true;
  stage?: "wake" | "runtime" | "kernel";
  code?: string;
  detail?: string;
  plainSendAvailable?: true;
  submitted?: false;
};
export type BannerTags = Omit<Banner, "text" | "tone">;

export type Notice = { text: string; tone: Tone };

/** The composer's receipt of one send, kept until the Gateway's record settles it. */
export type LocalMessage = {
  status: "sending" | "accepted" | "rejected" | "unknown";
  text: string;
  streamId: string | null;
  operationId?: string;
  unconfirmable?: true;
};

export type OperationEntry = {
  accepted?: boolean;
  completion?: OperationCompletion;
  cancelRequested?: boolean;
  restoredQueueCount?: number;
};

/** Live text of one operation before its message is in the snapshot: a new segment starts when tools ran in between. */
export type StreamSegment = { afterTools: number; part?: "thinking"; contentIndex?: number; text: string };

export type RunStage =
  | { stage: "waiting" | "thinking" | "output" }
  | { stage: "retry"; attempt: number }
  | { stage: "tool"; tools: { id: string; name: string }[] };

export type ActivityTone = "" | "notice" | "error";
export type Activity = { id: string; title: string; time: string | undefined; meta: string; tone: ActivityTone };

/** The Gateway's answer to a native action, or the page's own failure standing in for one. */
export type NativeActionReply = Pick<NativeActionResult, "requestId" | "action" | "status" | "command" | "data"> & { message?: string };
export type NativeFeedback = NativeActionReply & { sessionId?: string | null; cancellable?: boolean };

export type ReferenceFailure = { reason: string; text: string };
export type ReferenceCandidates = { value: NativeReferenceCandidate[]; truncated: boolean; loading: boolean; error: ReferenceFailure | null };

/** Text put back into the composer, and why: `undelivered` sends never ran; otherwise a stopped operation's queued inputs. */
export type RestoredDraft = { count: number; operationId?: string; reason?: "undelivered" };


export type SessionPendingKey =
  | "stopping" | `stopping:${string}` | "reconnecting" | "sending" | "nativeActionPending"
  | "archiving" | "sessionManaging" | "recovering" | "renaming";
export type WorkbenchPendingKey = "creating" | "projectMutating" | "archiveMutating" | "targetMutating" | "reloadingTargets";

export type Connection = "disconnected" | "connecting" | "connected";

/** Everything about the selected session that is replaced as a whole when the selection or its stream changes. */
export type SelectedSessionState = {
  streamId: string | null;
  lastSequence: number;
  snapshot: SessionHostSnapshot | null;
  historyPage: { loading: boolean; error: string };
  historyPageRevision: number;
  extensionUi: HostedExtensionUiSnapshot | null;
  extensionUiRender: ExtensionRender | null;
  extensionUiClientId: string;
  extensionUiRenderRequest: number;
  extensionUiRenderAcceptedRequest: number;
  connection: Connection;
  pending: Set<SessionPendingKey>;
  localMessages: Map<string, LocalMessage>;
  operations: Map<string, OperationEntry>;
  streams: Map<string, StreamSegment[]>;
  runStage: RunStage | null;
  toolRuns: Map<string, ToolRun>;
  toolContents: Map<string, ToolContent>;
  activities: Activity[];
  nativeCatalog: Loadable<NativeCatalog>;
  nativeFeedback: NativeFeedback[];
  referenceCandidates: ReferenceCandidates;
  restoredDraft: RestoredDraft | null;
  banner: Banner | null;
  error: string | null;
  notice: Notice | null;
  presentationRevision: number;
  transcriptRevision: number;
  terminalRefreshKey: number;
  recoveryMessage: string;
};

export type ViewMode = "instances" | "projects";

export type WorkbenchState = {
  service: "loading" | "ready" | "error";
  targets: TargetRow[];
  sessions: Map<string, SessionRow>;
  /** Archive groups from the Gateway workbench, newest first. */
  archive: ArchiveGroup[];
  /** Sessions whose stored data cannot be read. Diagnostics only; never in `sessions`. */
  unreadableSessions: UnreadableSession[];
  /** Root and supervisor designations; null until the first snapshot. */
  sessionControl: SessionControl | null;
  selectedSessionId: string | null;
  session: SelectedSessionState;
  extensionUiRenderIntervalMs: number | null;
  gatewayRestartUnit: string | null;
  /** Count of workbench-stream losses (a waiting page compares it with the value it started under) and whether the
   *  stream is open now (progress can be observed; a retry waits for it). */
  workbenchLinkLosses: number;
  workbenchLinked: boolean;
  viewMode: ViewMode;
  modelCatalog: Loadable<ModelCatalog>;
  attachments: StoredAttachment[];
  references: StoredReference[];
  showImages: boolean;
  draft: string;
  pending: Set<WorkbenchPendingKey>;
  queue: "steer" | "followUp";
  presentation: Presentation | null;
};
