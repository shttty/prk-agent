export function validHistoryPage(page) {
  return Array.isArray(page?.messages) && Array.isArray(page.messageEntryIds)
    && page.messageEntryIds.length === page.messages.length && page.messageEntryIds.every((id) => typeof id === "string")
    && (page.historyBefore === null || typeof page.historyBefore === "string")
    && (page.historyForkBefore === null || typeof page.historyForkBefore === "string") && Array.isArray(page.compactions)
    && Array.isArray(page.compactionEntryIds) && page.compactionEntryIds.every((id) => typeof id === "string");
}
