import type { StorageContext } from "../session-storage-types.ts";
import { notifyStorageFailure } from "./notify-storage-failure.ts";

export function storageWrite(ctx: StorageContext, key: string, value: unknown) {
  ctx.memoryStorage.set(key, value);
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    notifyStorageFailure(ctx, "浏览器存储不可用，刷新后草稿不会保留。");
  }
}
