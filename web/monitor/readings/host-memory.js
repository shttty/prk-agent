import { isRecord } from "./is-record.js";
import { limitBytes } from "./limit-bytes.js";
/** The plugin host's working set against its scope limit (monitor.remoteHost.memory, same shape as the kernel's).
 * null without a host or without a memory sample. */
export function hostMemory(remoteHost) {
  const memory = remoteHost?.memory;
  if (!isRecord(memory) || !Number.isFinite(memory.workingSet)) return null;
  const limit = typeof memory.memoryMax === "number" ? memory.memoryMax : limitBytes(memory.memoryMax);
  return { used: memory.workingSet, limit, percent: limit ? (memory.workingSet / limit) * 100 : null, oomKill: Number(memory.oomKill) || 0 };
}
