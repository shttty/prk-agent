import type { HostedExtensionUiSnapshot, HostedNode, KernelCellDelivery, PeerMessage, SessionHostSnapshot, ToolContent, ToolContentPreview } from "../../../src/gateway/wire/web-types.ts";
import type { ToolRun } from "../../workbench/payloads/tool-runs/tool-run-types.ts";
import type { NativeFeedback, StreamSegment } from "../../workbench/store/store-types.ts";
import type { ExtensionRender } from "../../workbench/store/extension-ui/extension-render-types.ts";
import type { MemoryNoticeDetails } from "../memory-notice/MemoryNotice.tsx";
import type { Payload } from "../payload/is-payload.ts";

// What the transcript projects out of the workbench state: the shapes assistant-ui carries to MessageView.

export type TextPart = { type: "text"; text: string };
export type ReasoningPart = { type: "reasoning"; text: string };
export type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  title?: string;
  args: Payload;
  argsText: string;
  result?: Payload;
  isError?: boolean;
  timing?: { startedAt?: number; completedAt?: number };
  artifact?: { output: string; running: boolean; unknown: boolean };
  metadata: { outcome?: "unknown"; inputPreview?: ToolContentPreview; inputLoaded?: boolean; outputPreview?: ToolContentPreview; outputLoaded?: boolean; via?: "tool_call"; renderId?: string };
};
export type MessagePart = TextPart | ReasoningPart | ToolCallPart;
export type MessageStatus = { type: "running" } | { type: "complete"; reason: "stop" } | { type: "incomplete"; reason?: string };
export type MessageRole = "user" | "assistant" | "system";

export type Attachment = { name?: string; type?: string; data?: string; size?: number; source?: string };
export type Reference = { type?: string; target?: string; sessionId?: string; source?: string; name?: string; path?: string; text?: string };
export type Compaction = NonNullable<SessionHostSnapshot["compactions"]>[number];
export type TerminalEvent = { kind: string; quiet_ms?: number; result: { name: string; status?: string; exit_code?: number } };
export type KernelEvent = { kind: string; eventId?: string; cellId: string; toolCallId?: string; step?: number; outcome?: string; sessionId?: string };
export type ExtensionNotification = HostedExtensionUiSnapshot["notifications"][number];

/** Per-message data the projection attaches next to the parts; assistant-ui hands it back as an untyped record. */
export type MessageCustom = {
  attachments?: Attachment[];
  references?: Reference[];
  peerMessage?: Omit<PeerMessage, "body">;
  copyText?: string;
  rerunText?: string;
  entryId?: string;
  entrySessionId?: string;
  forkBeforeEntryId?: string;
  forkEntryId?: string;
  forkSessionId?: string;
  extensionNode?: HostedNode;
  extensionNotification?: ExtensionNotification;
  compaction?: Compaction;
  memoryNotice?: MemoryNoticeDetails;
  terminalEvents?: TerminalEvent[];
  kernelEvent?: KernelEvent;
  sdkTimestamp?: number;
  turnStartedAt?: number;
  answerAt?: number;
  toolOnly?: boolean;
  toolUse?: boolean;
  live?: boolean;
  operationId?: string;
  completionStatus?: string;
  nativeFeedback?: boolean;
  requestId?: string;
  status?: string;
  action?: string;
  data?: unknown;
};

export type TranscriptMessage = {
  id: string;
  role: MessageRole;
  content: MessagePart[];
  createdAt: Date;
  status?: MessageStatus;
  metadata: { isOptimistic?: boolean; unstable_state?: undefined; unstable_annotations?: never[]; unstable_data?: never[]; steps?: never[]; custom: MessageCustom };
};

/** The SDK message in the snapshot, before projection: opaque until narrowed with `isPayload`. */
export type SdkMessage = Payload;

/** A tool call as the SDK or a live run describes it. */
export type ToolCall = {
  type?: string;
  toolCallId?: string;
  id?: string;
  toolName?: string;
  name?: string;
  args?: Payload;
  arguments?: Payload;
  title?: string;
  inputPreview?: ToolContentPreview;
  argumentsError?: string;
  inputLoaded?: boolean;
  outputLoaded?: boolean;
  createdAt?: unknown;
};

/** `run` is partial: a result that arrived by content load fills `output` before any live run exists. */
export type ToolRecord = { call: ToolCall; result?: Payload; run?: Partial<ToolRun> };


export type ConversationSnapshot = Partial<Pick<SessionHostSnapshot, "sessionId" | "state" | "operation" | "messageEntryIds" | "compactions" | "historyBefore" | "historyForkBefore">> & { messages?: readonly unknown[] };

/** The slice of the workbench state the projection reads (Chat selects exactly these fields). */
export type ConversationState = {
  selectedSessionId?: string | null;
  running?: boolean;
  session: {
    streamId?: string | null;
    snapshot?: ConversationSnapshot | null;
    extensionUi?: { notifications?: readonly ExtensionNotification[]; hiddenThinkingLabel?: string } | null;
    extensionUiRender?: Pick<ExtensionRender, "entries" | "messages" | "streaming" | "hiddenThinkingLabel"> | null;
    toolRuns: Map<string, ToolRun>;
    toolContents?: Map<string, ToolContent>;
    streams: Map<string, StreamSegment[]>;
    operations: Map<string, { completion?: unknown }>;
    nativeFeedback: NativeFeedback[];
  };
};

export type KernelCells = readonly KernelCellDelivery[];
