import { isRecord } from "../../payloads/is-record.js";
export function sanitizeAttachments(ctx, entries) {
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry) => isRecord(entry) && typeof entry.name === "string" && typeof entry.type === "string")
      .map((entry) => ({ name: entry.name.slice(0, 512), type: entry.type.slice(0, 128), size: Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : 0, ...(typeof entry.data === "string" ? { data: entry.data.slice(0, 1_048_576) } : {}), source: "browser" }));
  }

