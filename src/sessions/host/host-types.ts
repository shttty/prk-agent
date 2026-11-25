import type { SessionAttention } from "./attention/read-attention.ts";
import type { AgentSession, ContextUsage } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import type { KernelLanguage, KernelObservationSource, KernelSnapshot, PythonToolClient } from "../../kernel/kernel-types.ts";
import type { BranchHistoryPage, PersistedThinkingLevel } from "../history/history-types.ts";
import type { SessionOptions, ToolMode } from "../../config/session/session-options.ts";
import type { DelegationLevel } from "../../config/session/delegation-levels.ts";
import type { HostedExtensionUI, HostedExtensionUiSnapshot } from "../extension-ui/ui-types.ts";
import type { ExtensionHandlerScope } from "../extension-invocation/invocation-types.ts";
import type { PeerDelivery, PeerMessage } from "../../../shared/session-messages/message-types.js";
import type { CancelRequest, CancelResult, KernelInterruptRequest, KernelInterruptResult } from "./operations/cancel-types.ts";
import type { HostOperationSnapshot, Operation, OperationCompletion, OperationCompletionObserver, OperationKind } from "./operations/operation-types.ts";
export type { HostOperationSnapshot, Operation, OperationCompletion, OperationCompletionObserver, OperationCompletionStatus, OperationKind } from "./operations/operation-types.ts";
import type { KernelCellDelivery } from "../history/kernel-cells/delivery-types.ts";
import type { ModelTerminals } from "../../workspace/model-terminals/model-terminals-types.ts";
import type { TerminalSummary } from "../../workspace/terminals/terminals-types.ts";

// "sleeping" and "unavailable" are Gateway projections for a session without a runtime; a live host never enters them.
export type HostState = "idle" | "running" | "cancel_requested" | "sleeping" | "unavailable" | "closing" | "closed";
export interface SessionHostSnapshot extends SessionAttention {
  readonly sessionId: string;
  readonly streamId: string;
  readonly sequence: number;
  readonly state: HostState;
  readonly model?: string;
  readonly thinkingLevel?: PersistedThinkingLevel;
  /** Effective tool mode and child-session level: the snapshot is the page's one source for light settings. */
  readonly toolMode?: ToolMode;
  readonly kernelLanguage?: KernelLanguage;
  readonly delegation?: DelegationLevel;
  readonly localTools?: boolean;
  readonly scopedModels?: readonly string[];
  readonly modelFallback?: { readonly previousModel: string; readonly model: string; readonly reason: string };
  readonly contextUsage?: ContextUsage | undefined | null;
  readonly requiresReload?: boolean;
  readonly operation?: HostOperationSnapshot;
  readonly kernel?: KernelSnapshot;
  readonly kernelCells?: readonly KernelCellDelivery[];
  readonly terminals?: readonly TerminalSummary[];
  readonly messages: AgentSession["messages"];
  readonly historyThrough?: string | null;
  readonly receivingUserText?: string | null;
  readonly queuedMessages: { readonly steering: readonly string[]; readonly followUp: readonly string[] };
  readonly messageEntryIds?: readonly (string | null)[];
  readonly historyBefore?: BranchHistoryPage["historyBefore"];
  readonly historyForkBefore?: BranchHistoryPage["historyForkBefore"];
  readonly compactions?: BranchHistoryPage["compactions"];
  readonly compactionEntryIds?: BranchHistoryPage["compactionEntryIds"];
  readonly recentOperations?: readonly OperationCompletion[];
  readonly extensionUi?: HostedExtensionUiSnapshot;
}

export type SessionHostEventType =
  | "snapshot"
  | "request_accepted"
  | "request_rejected"
  | "operation_started"
  | "operation_cancel_requested"
  | "operation_completed"
  | "message"
  | "session_event"
  | "extension_ui"
  | "reload_started"
  | "reload_completed"
  | "state_changed"
  | "host_closed";

export interface SessionHostEvent {
  readonly streamId: string;
  readonly sequence: number;
  readonly timestamp: string;
  readonly type: SessionHostEventType;
  readonly sessionId: string;
  readonly requestId?: string;
  readonly operationId?: string;
  readonly text?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SessionHostSubscription {
  readonly snapshot: SessionHostSnapshot;
  unsubscribe(): void;
}
export interface SubmitMessageRequest {
  readonly requestId: string;
  readonly message: string;
  readonly queue?: "steer" | "followUp";
  readonly images?: readonly ImageContent[];
  /** Server-owned notification metadata; never inferred from ordinary message text. */
  readonly internalNotification?: Readonly<Record<string, unknown>>;
}

export interface AcceptedSubmission {
  readonly accepted: true;
  readonly requestId: string;
  readonly operationId: string;
  readonly sessionId: string;
  readonly completion: Promise<OperationCompletion>;
}

export interface RejectedSubmission {
  readonly accepted: false;
  readonly requestId: string;
  readonly error: string;
}

export type Submission = AcceptedSubmission | RejectedSubmission;


export interface DequeueResult {
  readonly operationId?: string;
  readonly status: "dequeued" | "not_found";
  readonly text?: string;
  readonly messages: readonly string[];
}

export interface PeerReceipt {
  readonly accepted: true;
  readonly pending: number;
  readonly delivery: "delivered" | "queued";
}

export interface SessionHost {
  readonly sessionId: string;
  /** Display timestamp for the active admitted run, absent while idle. */
  readonly startedAt?: number;
  readonly operationKind?: OperationKind;
  /** Host-owned requests and lifecycle work are settled; does not clone conversation history. */
  readonly isIdle?: boolean;
  /** A cell still owns execution or its durable result write; independent of user-turn admission. */
  hasInFlightCell?(): boolean;
  /** Current stream identity and execution state, without building or cloning a snapshot. */
  readonly streamId: string;
  readonly state: SessionHostSnapshot["state"];
  readonly attention?: SessionAttention;
  getSnapshot(includeMessages?: boolean): SessionHostSnapshot;
  subscribe(listener: (event: SessionHostEvent) => void): SessionHostSubscription;
  extensionUiAction?(args: Record<string, unknown>): Promise<unknown>;
  submit(request: SubmitMessageRequest): Promise<Submission>;
  compact(requestId: string, instructions?: string): AcceptedSubmission;
  receivePeer(message: PeerMessage, delivery?: PeerDelivery): Promise<PeerReceipt>;
  /** Awaited by the runtime's inline turn_end extension, not by session_send. */
  flushPeerInbox(): Promise<void>;
  cancel(request: CancelRequest): Promise<CancelResult>;
  interruptCell(request: KernelInterruptRequest): Promise<KernelInterruptResult>;
  dequeue(): DequeueResult;
  reload(): Promise<void>;
  close(): Promise<void>;
}
export interface SessionHostOptions {
  readonly session: AgentSession;
  readonly sessionOptions?: SessionOptions;
  readonly kernel?: KernelObservationSource & Partial<Pick<PythonToolClient, "interruptCell">>;
  readonly terminals?: Pick<ModelTerminals, "getSnapshot" | "subscribeState">;
  readonly extensionUi?: HostedExtensionUI;
  readonly extensionHandlers?: ExtensionHandlerScope;
  readonly dispose?: () => Promise<void>;
  readonly onOperationCompletion?: OperationCompletionObserver;
}

export interface HostContext {
  options: SessionHostOptions;
  session: AgentSession;
  kernel?: SessionHostOptions["kernel"];
  sessionOptions: SessionOptions;
  sessionId: string;
  streamId: string;
  listeners: Set<(event: SessionHostEvent) => void>;
  lifecycleTasks: Set<Promise<void>>;
  sequence: number;
  state: HostState;
  active?: Operation;
  retryGrace?: NodeJS.Timeout;
  stopped?: true;
  pendingCompaction?: Operation;
  recent: readonly OperationCompletion[];
  closing: boolean;
  closed: boolean;
  reloading: boolean;
  closePromise?: Promise<void>;
  dispatching: boolean;
  deliveries: SessionHostEvent[];
  inbox: { message: PeerMessage; delivery: "steer" | "followUp" }[];
  inboxChars: number;
  peerArrival: number;
  flushingInbox?: Promise<void>;
  discarded: Map<string, {
    sender: string; messageId: string; reason: string;
    disposition: "never-delivered" | "delivered-but-unprocessed";
  }>;
  lastNamespace?: KernelSnapshot["namespace"];
  unsubscribeExtensionUi?: () => void;
  unsubscribeSession?: () => void;
  unsubscribeKernel?: () => void;
  unsubscribeTerminals?: () => void;
}
