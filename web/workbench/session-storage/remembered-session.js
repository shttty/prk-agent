import { storageRead } from "./storage-access/storage-read.js";
import { isRecord } from "../payloads/is-record.js";
export function rememberedSession(ctx) {
    const value = storageRead(ctx, ctx.selectedStorageKey);
    if (!isRecord(value) || typeof value.sessionId !== "string" || !value.sessionId) return null;
    return { sessionId: value.sessionId };
  }

