import type { HostedExtensionUiSnapshot, SessionHostSnapshot, PublicExecutionTarget, ManagedSessionSnapshot } from "../../../src/gateway/wire/web-types.ts";
import type { NativeFeedback, StreamSegment, ToolContentCache, ToolRun } from "../conversation/conversation-types.ts";
import type { ExtensionRender } from "../extension-ui/extension-render-types.ts";
import type { SavedPresentation } from "../transcript/presentation-types.ts";
import type { Payload } from "../payload/is-payload.ts";
import type { CatalogModel, NativeCatalogValue, ReferenceCandidateView } from "../composer/composer-types.ts";

export type ChatSnapshot = Omit<SessionHostSnapshot, "messages"> & { messages: readonly unknown[] };
export type LoadState<T> = { value: T; loading: boolean; error: string | null };
/** A row of the sidebar's session list, as the workbench keeps it (`state.sessions`). */
export type ChatSessionRow = ManagedSessionSnapshot & Payload & { label: string };

/**
 * The part of the workbench state the chat region reads. The store (web/workbench) owns the full state; this lists
 * only the fields chat selects, so a selector that reads anything else fails to compile.
 */
export type ChatState = {
  selectedSessionId: string | null;
  sessions: Map<string, ChatSessionRow>;
  targets: readonly PublicExecutionTarget[];
  archive: readonly { sessions: readonly { sessionId: string }[] }[];
  presentation: SavedPresentation | null;
  showImages: boolean;
  draft: string;
  queue: "steer" | "followUp";
  attachments: ChatAttachment[];
  references: ChatReference[];
  pending: Set<string>;
  modelCatalog: LoadState<ModelCatalog | null>;
  extensionUiRenderIntervalMs: number | null;
  session: {
    streamId: string | null;
    snapshot: ChatSnapshot | null;
    connection: string;
    error: unknown;
    banner: { plainSendAvailable?: boolean } | null;
    pending: Set<string>;
    historyPage: { loading: boolean; error: string };
    historyPageRevision: number;
    presentationRevision: number;
    transcriptRevision: number;
    extensionUi: HostedExtensionUiSnapshot | null;
    extensionUiRender: ExtensionRender | null;
    extensionUiClientId: string;
    toolRuns: Map<string, ToolRun>;
    toolContents: Map<string, ToolContentCache>;
    streams: Map<string, StreamSegment[]>;
    operations: Map<string, { completion?: unknown }>;
    localMessages: Map<string, LocalMessage>;
    nativeFeedback: NativeFeedback[];
    nativeCatalog: LoadState<NativeCatalogValue | null>;
    referenceCandidates: { value: ReferenceCandidateView[]; truncated: boolean; loading: boolean; error: { reason?: string; text: string } | null };
    restoredDraft: { count?: number; reason?: string } | null;
    runStage: { stage?: string; tools?: { name?: string }[]; attempt?: number } | null;
  };
};

/** A send this page made that the Gateway has not confirmed yet. */
export type LocalMessage = { status?: string; unconfirmable?: boolean };
export type ChatAttachment = { id?: string; name: string; type: string; size: number; data?: string; source?: string };
export type ChatReference = { type?: string; target?: string; sessionId?: string; source?: string; name?: string; path?: string; text?: string };
export type ModelCatalog = { models?: CatalogModel[] };
