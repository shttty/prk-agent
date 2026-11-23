import { isRecord } from "../../payloads/is-record.js";
import { MAX_TEXT } from "../session-storage-constants.js";
export function sanitizeReferences(ctx, entries) {
    if (!Array.isArray(entries)) return [];
    const known = ["type", "source", "target", "targetIdentity", "sessionId", "path", "name", "text"];
    return entries.filter((entry) => isRecord(entry) && typeof entry.type === "string" && typeof entry.source === "string")
      .map((entry) => {
        const output = {};
        for (const key of known) {
          if (typeof entry[key] !== "string") continue;
          output[key] = entry[key].slice(0, key === "text" ? MAX_TEXT : key === "path" ? 4096 : 512);
        }
        return output;
      });
  }

