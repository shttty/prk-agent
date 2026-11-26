import type { MachineSample } from "../../../src/gateway/wire/web-types.ts";

export function machineMemory(machine: MachineSample | undefined) {
  const mem = machine?.mem;
  if (!mem) return null;
  const used = mem.total - mem.available;
  return { used, total: mem.total, percent: mem.total ? (used / mem.total) * 100 : 0 };
}
