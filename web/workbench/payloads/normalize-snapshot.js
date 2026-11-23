import { isRecord } from "./is-record.js";
export function normalizeSnapshot(value) {
  if (!isRecord(value) || typeof value.sessionId !== "string" || typeof value.streamId !== "string" || !value.streamId
    || !Number.isSafeInteger(value.sequence) || typeof value.state !== "string"
    || !Array.isArray(value.messages)) return null;
  return { ...value, recentOperations: Array.isArray(value.recentOperations) ? value.recentOperations : [] };
}

