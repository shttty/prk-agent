import { isRecord } from "./is-record.js";
export function sampleAgeSeconds(monitor, sample, now = Date.now()) {
  if (!monitor || !isRecord(sample) || !Number.isFinite(sample.ageMs)) return null;
  return Math.round((sample.ageMs + Math.max(0, now - (monitor.receivedAt ?? now))) / 1000);
}
