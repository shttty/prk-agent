export function mergeLoadedHistory(previous, snapshot) {
  const firstId = snapshot.messageEntryIds?.[0];
  const offset = typeof firstId === "string" ? previous?.messageEntryIds?.indexOf(firstId) ?? -1 : -1;
  if (offset <= 0) return snapshot;
  const prefixIds = previous.messageEntryIds.slice(0, offset);
  const keptIds = new Set(prefixIds);
  const compactionIds = new Set(snapshot.compactionEntryIds);
  const compactions = new Map((previous.compactions || []).filter((entry) => compactionIds.has(entry.entryId) && keptIds.has(entry.beforeEntryId)).map((entry) => [entry.entryId, entry]));
  for (const entry of snapshot.compactions || []) compactions.set(entry.entryId, entry);
  return {
    ...snapshot,
    messages: [...previous.messages.slice(0, offset), ...snapshot.messages],
    messageEntryIds: [...prefixIds, ...snapshot.messageEntryIds],
    historyBefore: previous.historyBefore,
    historyForkBefore: previous.historyForkBefore,
    compactions: [...compactions.values()],
  };
}
