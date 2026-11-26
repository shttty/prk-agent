import { isPayload } from "../payload/is-payload.ts";
import type { Payload } from "../payload/is-payload.ts";
import { asText } from "./as-text.ts";

export type NestedSummary = { name: string; count: number; failed: boolean };

/**
 * Sub-calls a tool made (the SDK keeps a bounded `nestedCalls: { calls: [{ name, status }] }` on the outer result
 * message): one entry per tool name in first-call order, with a count and whether any of them failed.
 */
export function nestedSummary(result: Payload | undefined): NestedSummary[] {
  const nested = result?.nestedCalls;
  const calls = isPayload(nested) ? nested.calls : undefined;
  if (!Array.isArray(calls)) return [];
  const byName = new Map<string, NestedSummary>();
  for (const call of calls.filter(isPayload)) {
    const name = asText(call.name);
    if (!name) continue;
    const entry = byName.get(name) || { name, count: 0, failed: false };
    entry.count += 1;
    if (call.status === "error") entry.failed = true;
    byName.set(name, entry);
  }
  return [...byName.values()];
}
