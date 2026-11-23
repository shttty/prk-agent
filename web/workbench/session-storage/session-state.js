import { sessionStorageKey } from "./storage-access/session-storage-key.js";
import { storageRead } from "./storage-access/storage-read.js";
import { normalizePresentation } from "./sanitizing/normalize-presentation.js";
import { sanitizeAttachments } from "./sanitizing/sanitize-attachments.js";
import { sanitizeReferences } from "./sanitizing/sanitize-references.js";
import { normalizeRestoredQueueCounts } from "./sanitizing/normalize-restored-queue-counts.js";
export function sessionState(ctx, sessionId) {
    if (!sessionId) return null;
    const key = sessionStorageKey(ctx, sessionId);
    const stored = storageRead(ctx, key);
    const presentation = normalizePresentation(stored?.presentation, stored?.scrollTop);
    return {
      draft: typeof stored?.draft === "string" ? stored.draft : "",
      scrollTop: presentation.scrollTop,
      presentation,
      attachments: sanitizeAttachments(ctx, stored?.attachments),
      references: sanitizeReferences(ctx, stored?.references),
      restoredQueueCounts: normalizeRestoredQueueCounts(stored?.restoredQueueCounts),
    };
  }

