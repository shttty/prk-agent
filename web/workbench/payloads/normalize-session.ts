import type { SessionRow } from "../store/store-types.ts";
import { isRecord } from "./is-record.ts";
import { stampMonitor } from "../../monitor/readings/stamp-monitor.js";

/** A session row from the Gateway (list, event or an HTTP answer): shape checked by `sessionId`, then taken as sent. */
export function normalizeSession(value: unknown): SessionRow | null {
  if (!isRecord(value) || typeof value.sessionId !== "string" || !value.sessionId.trim()) return null;
  const { machine: _machine, machineId: _machineId, monitor, ...sessionRow } = value;
  return { ...(sessionRow as Omit<SessionRow, "monitor">), ...(isRecord(monitor) ? { monitor: stampMonitor(monitor) } : {}) };
}
