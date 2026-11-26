import type { ToolContent } from "../../../src/gateway/wire/web-types.ts";
import type { Presentation } from "../session-storage/session-storage-types.ts";
import type { SessionStorage } from "../session-storage/session-storage-types.ts";
import type { WorkbenchState } from "./store-types.ts";

export type PatchOptions = { displayOnly?: boolean };

/** A render of the extension UI queued for the next interval; `toolContentExpandedIds` is added by the store. */
export type ExtensionUiRenderArgs = { width: number; height: number; expandedToolCallIds?: string[]; operationId?: string };
export type ExtensionUiRenderRequest = ExtensionUiRenderArgs & { toolContentExpandedIds: string[]; historyStart?: string };

/** What the transcript reports on request: where it is scrolled to, or null when it is gone. */
export type ScrollSampler = () => Pick<Presentation, "scrollTop" | "anchor"> | null;

/** The one mutable object behind a store: functions in this directory take it first and change it through `patch`. */
export type StoreContext = {
  readonly apiRoot: string;
  state: WorkbenchState;
  listeners: Set<() => void>;
  storage: SessionStorage;
  source: EventSource | null;
  workbenchSource: EventSource | null;
  /** Bumped by every selection change; an async step compares it to know the selection moved on. */
  selectionToken: number;
  disposed: boolean;
  referenceRequestToken: number;
  locationListenerInstalled: boolean;
  draftRevision: number;
  renderTimer: ReturnType<typeof setTimeout> | undefined;
  renderPending: ExtensionUiRenderRequest | null;
  renderFlight: Promise<unknown> | null;
  renderStartedAt: number;
  displayNotifyCancel: (() => void) | null;
  toolContentRequests: Map<string, Promise<ToolContent>>;
  /** Per session: the stream a wake was answered on (waiting for its snapshot), or null while the request is in flight. */
  wakeRequests: Map<string, string | null>;
  /** requestIds of unknown sends whose status query is in flight. */
  sendChecks: Set<string>;
  noticeTimer: ReturnType<typeof setTimeout> | undefined;
  scrollSample: ScrollSampler | null;
  scrollTimer: ReturnType<typeof setTimeout> | undefined;
  historyRefresh: { through: string | null; streamId: string | null } | undefined;
  /** Window and document listeners need one stable function each to be removed again. */
  pageListeners: { locationChange: () => void; connectionResume: () => void; flushScroll: () => void };
};
