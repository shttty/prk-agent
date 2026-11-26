import type { SessionMonitor } from "../../../src/gateway/wire/web-types.ts";
import type { StampedMonitor } from "./monitor-types.ts";

/** The Gateway's monitor reading (a session row or a `session_monitor` event), taken as sent plus when it arrived. */
export function stampMonitor(monitor: Record<string, unknown>, now = Date.now()): StampedMonitor {
  // External input boundary: the Gateway builds this object; callers only know it is a record.
  return { ...(monitor as unknown as SessionMonitor), receivedAt: now };
}
