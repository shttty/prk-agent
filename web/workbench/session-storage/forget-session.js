import { sessionStorageKey } from "./storage-access/session-storage-key.js";
import { rememberedSession } from "./remembered-session.js";
import { notifyStorageFailure } from "./storage-access/notify-storage-failure.js";
export function forgetSession(ctx, sessionId) {
    const keys = [sessionStorageKey(ctx, sessionId)];
    if (rememberedSession(ctx)?.sessionId === sessionId) keys.push(ctx.selectedStorageKey);
    for (const key of keys) {
      ctx.memoryStorage.delete(key);
      try { globalThis.sessionStorage?.removeItem(key); }
      catch { notifyStorageFailure(ctx, "历史已删除，但浏览器存储清理失败。"); }
    }
  }

