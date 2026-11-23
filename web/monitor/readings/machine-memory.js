import { isRecord } from "./is-record.js";
export function machineMemory(machine) {
  const mem = machine?.mem;
  if (!isRecord(mem) || !Number.isFinite(mem.total)) return null;
  const used = mem.total - mem.available;
  return { used, total: mem.total, percent: mem.total ? (used / mem.total) * 100 : 0 };
}
