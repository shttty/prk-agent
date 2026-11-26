import type { SessionHostSnapshot } from "../../../src/gateway/wire/web-types.ts";
import type { NormalizedSnapshot } from "./payload-types.ts";
import { isRecord } from "./is-record.ts";

/** A session snapshot from the Gateway: shape checked by its identity and ordering fields, then taken as sent. */
export function normalizeSnapshot(value: unknown): NormalizedSnapshot | null {
  if (!isRecord(value) || typeof value.sessionId !== "string" || typeof value.streamId !== "string" || !value.streamId
    || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || typeof value.state !== "string"
    || !Array.isArray(value.messages)) return null;
  const snapshot = value as unknown as SessionHostSnapshot;
  return { ...snapshot, recentOperations: snapshot.recentOperations ?? [] };
}
