import { notifyStorageFailure } from "./notify-storage-failure.js";
export function storageWrite(ctx, key, value) {
    ctx.memoryStorage.set(key, value);
    try {
      globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
    } catch {
      notifyStorageFailure(ctx, "浏览器存储不可用，刷新后草稿不会保留。");
    }
  }

