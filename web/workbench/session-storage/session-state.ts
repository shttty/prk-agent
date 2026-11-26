import type { SavedSessionState, StorageContext } from "./session-storage-types.ts";
import { sessionStorageKey } from "./storage-access/session-storage-key.ts";
import { storageRead } from "./storage-access/storage-read.ts";
import { isRecord } from "../payloads/is-record.ts";
import { normalizePresentation } from "./sanitizing/normalize-presentation.ts";
import { sanitizeAttachments } from "./sanitizing/sanitize-attachments.ts";
import { sanitizeReferences } from "./sanitizing/sanitize-references.ts";
import { normalizeRestoredQueueCounts } from "./sanitizing/normalize-restored-queue-counts.ts";
import { normalizeUnknownSends } from "./sanitizing/normalize-unknown-sends.ts";

/** What was saved for the session, validated once here; a missing or unreadable record reads as an empty one. */
export function sessionState(ctx: StorageContext, sessionId: string): SavedSessionState {
  const value = storageRead(ctx, sessionStorageKey(ctx, sessionId));
  const stored = isRecord(value) ? value : {};
  const presentation = normalizePresentation(stored.presentation, typeof stored.scrollTop === "number" ? stored.scrollTop : undefined);
  return {
    draft: typeof stored.draft === "string" ? stored.draft : "",
    scrollTop: presentation.scrollTop,
    presentation,
    attachments: sanitizeAttachments(stored.attachments),
    references: sanitizeReferences(stored.references),
    restoredQueueCounts: normalizeRestoredQueueCounts(stored.restoredQueueCounts),
    unknownSends: normalizeUnknownSends(stored.unknownSends),
  };
}
