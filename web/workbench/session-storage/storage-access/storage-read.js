import { notifyStorageFailure } from "./notify-storage-failure.js";
export function storageRead(ctx, key) {
    if (ctx.memoryStorage.has(key)) return ctx.memoryStorage.get(key);
    try {
      const raw = globalThis.sessionStorage?.getItem(key);
      if (raw === null || raw === undefined) return undefined;
      const value = JSON.parse(raw);
      ctx.memoryStorage.set(key, value);
      return value;
    } catch {
      notifyStorageFailure(ctx, "浏览器存储不可用，刷新后草稿不会保留。");
      return undefined;
    }
  }

