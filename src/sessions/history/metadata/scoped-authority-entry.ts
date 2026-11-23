import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { SUBJECT_SCOPED_AUTHORITY_TYPES } from "../history-protocol.ts";

export function scopedAuthorityEntry(entry: SessionEntry): entry is Extract<SessionEntry, { type: "custom" }> {
  return entry.type === "custom" && SUBJECT_SCOPED_AUTHORITY_TYPES[entry.customType] === true;
}
