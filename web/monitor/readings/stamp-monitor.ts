import type { SessionMonitor } from "../../../src/gateway/wire/web-types.ts";
import type { StampedMonitor } from "./monitor-types.ts";

export function stampMonitor(monitor: SessionMonitor, now = Date.now()): StampedMonitor {
  return { ...monitor, receivedAt: now };
}
