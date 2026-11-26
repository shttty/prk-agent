import type { StoredReference } from "../session-storage-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { MAX_TEXT } from "../session-storage-constants.ts";

const OPTIONAL_KEYS = ["target", "targetIdentity", "sessionId", "path", "name", "text"] as const;

export function sanitizeReferences(entries: unknown): StoredReference[] {
  if (!Array.isArray(entries)) return [];
  const references: StoredReference[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.type !== "string" || typeof entry.source !== "string") continue;
    const reference: StoredReference = { type: entry.type.slice(0, 512), source: entry.source.slice(0, 512) };
    for (const key of OPTIONAL_KEYS) {
      const value = entry[key];
      if (typeof value === "string") reference[key] = value.slice(0, key === "text" ? MAX_TEXT : key === "path" ? 4096 : 512);
    }
    references.push(reference);
  }
  return references;
}
