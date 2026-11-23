
export function normalizeRestoredQueueCounts(value) {
  return Array.isArray(value)
    ? value.filter((entry) => Array.isArray(entry) && typeof entry[0] === "string"
      && Number.isSafeInteger(entry[1]) && entry[1] > 0)
      .map(([operationId, count]) => [operationId, count])
    : [];
}

