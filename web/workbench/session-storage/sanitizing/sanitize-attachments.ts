import type { StoredAttachment } from "../session-storage-types.ts";
import { isRecord } from "../../payloads/is-record.ts";

export function sanitizeAttachments(entries: unknown): StoredAttachment[] {
  if (!Array.isArray(entries)) return [];
  const attachments: StoredAttachment[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.name !== "string" || typeof entry.type !== "string") continue;
    attachments.push({
      name: entry.name.slice(0, 512),
      type: entry.type.slice(0, 128),
      size: typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : 0,
      ...(typeof entry.data === "string" ? { data: entry.data.slice(0, 1_048_576) } : {}),
      source: "browser",
    });
  }
  return attachments;
}
