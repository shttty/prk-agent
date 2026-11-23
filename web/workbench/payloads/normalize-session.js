import { isRecord } from "./is-record.js";
import { stampMonitor } from "../../monitor/readings/stamp-monitor.js";
export function normalizeSession(value) {
  if (!isRecord(value) || typeof value.sessionId !== "string" || !value.sessionId.trim()) return null;
  const { machine: _machine, machineId: _machineId, monitor, ...sessionRow } = value;
  return { ...sessionRow, ...(isRecord(monitor) ? { monitor: stampMonitor(monitor) } : {}) };
}

