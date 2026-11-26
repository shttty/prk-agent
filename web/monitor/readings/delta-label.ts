import type { MonitoredRow } from "./monitor-types.ts";

const compact = (value: number) => (value >= 10000 ? `${Math.round(value / 1000)}k` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value));

export function deltaLabel({ monitor }: MonitoredRow): string | null {
  const changes = monitor?.changes;
  if (!changes) return null;
  if (changes.added > 0) return `+${compact(changes.added)}`;
  if (changes.removed > 0) return `-${compact(changes.removed)}`;
  return changes.files.length > 0 ? "±" : null;
}
