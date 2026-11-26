import type { StorageContext } from "../session-storage-types.ts";

export function notifyStorageFailure(ctx: StorageContext, message: string) {
  if (ctx.storageWarningShown) return;
  ctx.storageWarningShown = true;
  ctx.onStorageFailure?.(message);
}
