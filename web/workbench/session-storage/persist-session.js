import { sessionState } from "./session-state.js";
import { normalizePresentation } from "./sanitizing/normalize-presentation.js";
import { storageWrite } from "./storage-access/storage-write.js";
import { sessionStorageKey } from "./storage-access/session-storage-key.js";
import { sanitizeAttachments } from "./sanitizing/sanitize-attachments.js";
import { sanitizeReferences } from "./sanitizing/sanitize-references.js";
import { normalizeRestoredQueueCounts } from "./sanitizing/normalize-restored-queue-counts.js";
import { normalizeUnknownSends } from "./sanitizing/normalize-unknown-sends.js";
export function persistSession(ctx, sessionId, overrides = {}) {
    if (!sessionId) return;
    const previous = sessionState(ctx, sessionId);
    const presentation = normalizePresentation(overrides.presentation || previous.presentation, overrides.scrollTop ?? previous.scrollTop);
    storageWrite(ctx, sessionStorageKey(ctx, sessionId), {
      draft: typeof overrides.draft === "string" ? overrides.draft : previous.draft,
      scrollTop: presentation.scrollTop,
      presentation,
      attachments: sanitizeAttachments(ctx, overrides.attachments || previous.attachments),
      references: sanitizeReferences(ctx, overrides.references || previous.references),
      restoredQueueCounts: normalizeRestoredQueueCounts(overrides.restoredQueueCounts ?? previous.restoredQueueCounts),
      unknownSends: normalizeUnknownSends(overrides.unknownSends ?? previous.unknownSends),
    });
  }

