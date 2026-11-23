import { storageWrite } from "./storage-access/storage-write.js";
export function persistSelectedSession(ctx, sessionId) {
    if (sessionId) storageWrite(ctx, ctx.selectedStorageKey, { sessionId });
  }

