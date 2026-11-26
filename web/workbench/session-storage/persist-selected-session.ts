import type { StorageContext } from "./session-storage-types.ts";
import { storageWrite } from "./storage-access/storage-write.ts";

export function persistSelectedSession(ctx: StorageContext, sessionId: string) {
  if (sessionId) storageWrite(ctx, ctx.selectedStorageKey, { sessionId });
}
