import type { KernelSnapshot } from "../../../src/gateway/wire/web-types.ts";
import { limitBytes } from "./limit-bytes.ts";

/** A kernel's or plugin host's working set against its scope limit; null without a memory sample. */
export function kernelMemory(memory: KernelSnapshot["memory"]) {
  if (!memory) return null;
  const limit = limitBytes(memory.memoryMax);
  return { used: memory.workingSet, limit, percent: limit ? (memory.workingSet / limit) * 100 : null, oomKill: memory.oomKill };
}
