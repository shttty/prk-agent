/** A browser file kept with the draft (the composer reads it into base64 `data`). */
export type StoredAttachment = { name: string; type: string; size: number; data?: string; source: "browser" };

/** One `@` reference of the composer: a target file or session mention, strings only. */
export type StoredReference = { type: string; source: string; target?: string; targetIdentity?: string; sessionId?: string; path?: string; name?: string; text?: string };

/** Where the transcript was scrolled to: the row at the viewport top and the offset into it. */
export type PresentationAnchor = { index: number; key: string; role: string; text: string; offset: number };

export type Presentation = { scrollTop: number; anchor: PresentationAnchor | null; openedTools: string[] };

/** A send whose result is still unknown, saved so a reload can ask the Gateway what became of it. */
export type UnknownSend = { text: string; streamId: string; unconfirmable?: true };

export type RestoredQueueCount = [operationId: string, count: number];
export type UnknownSendEntry = [requestId: string, send: UnknownSend];

/** Everything the page keeps per session across reloads. */
export type SavedSessionState = {
  draft: string;
  scrollTop: number;
  presentation: Presentation;
  attachments: StoredAttachment[];
  references: StoredReference[];
  restoredQueueCounts: RestoredQueueCount[];
  unknownSends: UnknownSendEntry[];
};

/** Fields a caller replaces; the rest are read back from what was saved. Values are sanitized on the way in. */
export type SavedSessionChanges = {
  draft?: string;
  scrollTop?: number;
  presentation?: Presentation | null;
  attachments?: readonly StoredAttachment[];
  references?: readonly StoredReference[];
  restoredQueueCounts?: readonly RestoredQueueCount[];
  unknownSends?: readonly UnknownSendEntry[];
};

export type StorageContext = {
  apiRoot: string;
  onStorageFailure: ((message: string) => void) | undefined;
  storageNamespace: string;
  /** Parsed values by key: what sessionStorage cannot hold (private mode) still lasts for this page. */
  memoryStorage: Map<string, unknown>;
  selectedStorageKey: string;
  storageWarningShown: boolean;
};

export type SessionStorage = {
  sessionState: (sessionId: string) => SavedSessionState;
  persistSession: (sessionId: string, changes?: SavedSessionChanges) => void;
  persistSelectedSession: (sessionId: string) => void;
  rememberedSession: () => { sessionId: string } | null;
  forgetSession: (sessionId: string) => void;
  normalizePresentation: (value: unknown, fallbackTop?: number) => Presentation;
};
