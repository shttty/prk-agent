import type { StorageContext } from "./session-storage-types.ts";
import { sessionStorageKey } from "./storage-access/session-storage-key.ts";
import { rememberedSession } from "./remembered-session.ts";
import { notifyStorageFailure } from "./storage-access/notify-storage-failure.ts";

export function forgetSession(ctx: StorageContext, sessionId: string) {
  const keys = [sessionStorageKey(ctx, sessionId)];
  if (rememberedSession(ctx)?.sessionId === sessionId) keys.push(ctx.selectedStorageKey);
  for (const key of keys) {
    ctx.memoryStorage.delete(key);
    try { globalThis.sessionStorage?.removeItem(key); }
    catch { notifyStorageFailure(ctx, "历史已删除，但浏览器存储清理失败。"); }
  }
}
