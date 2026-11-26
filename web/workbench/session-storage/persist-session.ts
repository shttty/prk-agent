import type { SavedSessionChanges, SavedSessionState, StorageContext } from "./session-storage-types.ts";
import { sessionState } from "./session-state.ts";
import { normalizePresentation } from "./sanitizing/normalize-presentation.ts";
import { storageWrite } from "./storage-access/storage-write.ts";
import { sessionStorageKey } from "./storage-access/session-storage-key.ts";
import { sanitizeAttachments } from "./sanitizing/sanitize-attachments.ts";
import { sanitizeReferences } from "./sanitizing/sanitize-references.ts";
import { normalizeRestoredQueueCounts } from "./sanitizing/normalize-restored-queue-counts.ts";
import { normalizeUnknownSends } from "./sanitizing/normalize-unknown-sends.ts";

export function persistSession(ctx: StorageContext, sessionId: string, changes: SavedSessionChanges = {}) {
  if (!sessionId) return;
  const previous = sessionState(ctx, sessionId);
  const presentation = normalizePresentation(changes.presentation || previous.presentation, changes.scrollTop ?? previous.scrollTop);
  const saved: SavedSessionState = {
    draft: typeof changes.draft === "string" ? changes.draft : previous.draft,
    scrollTop: presentation.scrollTop,
    presentation,
    attachments: sanitizeAttachments(changes.attachments || previous.attachments),
    references: sanitizeReferences(changes.references || previous.references),
    restoredQueueCounts: normalizeRestoredQueueCounts(changes.restoredQueueCounts ?? previous.restoredQueueCounts),
    unknownSends: normalizeUnknownSends(changes.unknownSends ?? previous.unknownSends),
  };
  storageWrite(ctx, sessionStorageKey(ctx, sessionId), saved);
}
