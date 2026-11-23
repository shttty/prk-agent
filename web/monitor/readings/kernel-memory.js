import { isRecord } from "./is-record.js";
import { limitBytes } from "./limit-bytes.js";
export function kernelMemory(kernel) {
  const memory = kernel?.memory;
  if (!isRecord(memory) || !Number.isFinite(memory.workingSet)) return null;
  const limit = limitBytes(memory.memoryMax);
  return { used: memory.workingSet, limit, percent: limit ? (memory.workingSet / limit) * 100 : null, oomKill: Number(memory.oomKill) || 0 };
}
