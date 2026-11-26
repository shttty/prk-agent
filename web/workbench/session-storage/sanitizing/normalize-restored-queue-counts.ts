import type { RestoredQueueCount } from "../session-storage-types.ts";

export function normalizeRestoredQueueCounts(value: unknown): RestoredQueueCount[] {
  if (!Array.isArray(value)) return [];
  const counts: RestoredQueueCount[] = [];
  for (const entry of value) {
    if (Array.isArray(entry) && typeof entry[0] === "string" && Number.isSafeInteger(entry[1]) && entry[1] > 0) counts.push([entry[0], entry[1]]);
  }
  return counts;
}
