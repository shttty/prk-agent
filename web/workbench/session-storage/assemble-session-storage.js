import { notifyStorageFailure } from "./storage-access/notify-storage-failure.js";
import { storageRead } from "./storage-access/storage-read.js";
import { storageWrite } from "./storage-access/storage-write.js";
import { sessionStorageKey } from "./storage-access/session-storage-key.js";
import { sanitizeAttachments } from "./sanitizing/sanitize-attachments.js";
import { sanitizeReferences } from "./sanitizing/sanitize-references.js";
import { sessionState } from "./session-state.js";
import { persistSession } from "./persist-session.js";
import { persistSelectedSession } from "./persist-selected-session.js";
import { rememberedSession } from "./remembered-session.js";
import { forgetSession } from "./forget-session.js";
import { normalizePresentation } from "./sanitizing/normalize-presentation.js";
import { namespaceFor } from "./storage-access/namespace-for.js";
export function createSessionStorage({ apiRoot = "/api", onStorageFailure } = {}) {
  const ctx = { onStorageFailure, apiRoot };
  ctx.bound = {
    notifyStorageFailure: (...args) => notifyStorageFailure(ctx, ...args),
    storageRead: (...args) => storageRead(ctx, ...args),
    storageWrite: (...args) => storageWrite(ctx, ...args),
    sessionStorageKey: (...args) => sessionStorageKey(ctx, ...args),
    sanitizeAttachments: (...args) => sanitizeAttachments(ctx, ...args),
    sanitizeReferences: (...args) => sanitizeReferences(ctx, ...args),
    sessionState: (...args) => sessionState(ctx, ...args),
    persistSession: (...args) => persistSession(ctx, ...args),
    persistSelectedSession: (...args) => persistSelectedSession(ctx, ...args),
    rememberedSession: (...args) => rememberedSession(ctx, ...args),
    forgetSession: (...args) => forgetSession(ctx, ...args),
  };
  ctx.storageNamespace = namespaceFor(ctx.apiRoot);
  ctx.memoryStorage = new Map();
  ctx.selectedStorageKey = `${ctx.storageNamespace}:selected`;
  ctx.storageWarningShown = false;
  return {
    sessionState: ctx.bound.sessionState,
    persistSession: ctx.bound.persistSession,
    persistSelectedSession: ctx.bound.persistSelectedSession,
    rememberedSession: ctx.bound.rememberedSession,
    forgetSession: ctx.bound.forgetSession,
    normalizePresentation,
  };
}

