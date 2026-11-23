import type { CapabilityChange } from "./capability-types.ts";
import { capabilityId } from "./validate-capability-id.ts";

export function isCapabilityBatch(value: unknown): value is { changes: CapabilityChange[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { changes } = value as Record<string, unknown>;
  if (!Array.isArray(changes) || changes.length === 0) return false;
  const ids = new Set<string>();
  return changes.every((change: unknown) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) return false;
    const entry = change as Record<string, unknown>;
    if (Object.keys(entry).some((key) => key !== "id" && key !== "enabled") || !capabilityId(entry.id)
      || (typeof entry.enabled !== "boolean" && entry.enabled !== null) || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}
