import { asText } from "./as-text.js";
/**
 * Sub-calls a tool made (the SDK keeps a bounded `nestedCalls: { calls: [{ name, status }] }` on the outer result
 * message): one entry per tool name in first-call order, with a count and whether any of them failed.
 */
export function nestedSummary(result) {
  const calls = result?.nestedCalls?.calls;
  if (!Array.isArray(calls)) return [];
  const byName = new Map();
  for (const call of calls) {
    const name = asText(call?.name);
    if (!name) continue;
    const entry = byName.get(name) || { name, count: 0, failed: false };
    entry.count += 1;
    if (call.status === "error") entry.failed = true;
    byName.set(name, entry);
  }
  return [...byName.values()];
}
