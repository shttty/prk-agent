import { isRecord } from "./is-record.js";
export function stampMonitor(monitor, now = Date.now()) {
  return isRecord(monitor) ? { ...monitor, receivedAt: now } : undefined;
}
