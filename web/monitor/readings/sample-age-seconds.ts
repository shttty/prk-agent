import type { StampedMonitor } from "./monitor-types.ts";

export function sampleAgeSeconds(monitor: StampedMonitor | undefined, sample: { ageMs: number } | undefined, now = Date.now()): number | null {
  if (!monitor || !sample) return null;
  return Math.round((sample.ageMs + Math.max(0, now - monitor.receivedAt)) / 1000);
}
