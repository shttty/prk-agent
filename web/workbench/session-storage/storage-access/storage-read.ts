import type { StorageContext } from "../session-storage-types.ts";
import { notifyStorageFailure } from "./notify-storage-failure.ts";

/** The saved value for `key`, or undefined when there is none or the browser storage cannot be read. */
export function storageRead(ctx: StorageContext, key: string): unknown {
  if (ctx.memoryStorage.has(key)) return ctx.memoryStorage.get(key);
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    if (raw === null || raw === undefined) return undefined;
    const value: unknown = JSON.parse(raw);
    ctx.memoryStorage.set(key, value);
    return value;
  } catch {
    notifyStorageFailure(ctx, "浏览器存储不可用，刷新后草稿不会保留。");
    return undefined;
  }
}
