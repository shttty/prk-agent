import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";

/** A new snapshot (without the earlier pages the user already loaded) put in front of those pages again. */
export function mergeLoadedHistory<S extends SessionHostSnapshot>(previous: SessionHostSnapshot | null, snapshot: S): S {
  const firstId = snapshot.messageEntryIds?.[0];
  const previousIds = previous?.messageEntryIds;
  const offset = previous && previousIds && typeof firstId === "string" ? previousIds.indexOf(firstId) : -1;
  if (!previous || !previousIds || offset <= 0) return snapshot;
  const prefixIds = previousIds.slice(0, offset);
  const keptIds = new Set(prefixIds);
  const compactionIds = new Set(snapshot.compactionEntryIds);
  const compactions = new Map((previous.compactions || []).filter((entry) => compactionIds.has(entry.entryId) && entry.beforeEntryId !== null && keptIds.has(entry.beforeEntryId)).map((entry) => [entry.entryId, entry]));
  for (const entry of snapshot.compactions || []) compactions.set(entry.entryId, entry);
  return {
    ...snapshot,
    messages: [...previous.messages.slice(0, offset), ...snapshot.messages],
    messageEntryIds: [...prefixIds, ...(snapshot.messageEntryIds ?? [])],
    historyBefore: previous.historyBefore,
    historyForkBefore: previous.historyForkBefore,
    compactions: [...compactions.values()],
  };
}
