import type { StorageContext } from "../session-storage-types.ts";

export function sessionStorageKey(ctx: StorageContext, sessionId: string): string {
  return `${ctx.storageNamespace}:session:${encodeURIComponent(sessionId)}`;
}
