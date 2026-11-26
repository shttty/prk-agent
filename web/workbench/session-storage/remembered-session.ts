import type { StorageContext } from "./session-storage-types.ts";
import { storageRead } from "./storage-access/storage-read.ts";
import { isRecord } from "../payloads/is-record.ts";

export function rememberedSession(ctx: StorageContext): { sessionId: string } | null {
  const value = storageRead(ctx, ctx.selectedStorageKey);
  if (!isRecord(value) || typeof value.sessionId !== "string" || !value.sessionId) return null;
  return { sessionId: value.sessionId };
}
