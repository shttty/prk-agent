import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export function latestCustomEntry(entries: readonly SessionEntry[], customType: string): Extract<SessionEntry, { type: "custom" }> | undefined {
  return entries.findLast((entry): entry is Extract<SessionEntry, { type: "custom" }> => entry?.type === "custom" && entry.customType === customType);
}
