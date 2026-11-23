import { machineMemory } from "./machine-memory.js";
import { isRecord } from "./is-record.js";
export const finite = (value) => (Number.isFinite(value) ? value : null);

export function machinePoint({ at, value: machine }) {
  const memory = machineMemory(machine);
  const disk = isRecord(machine.disk) && machine.disk.total > 0 ? ((machine.disk.total - machine.disk.free) / machine.disk.total) * 100 : null;
  return {
    t: at,
    cpu: finite(machine.cpu?.pct),
    mem: memory ? memory.percent : null,
    load: Array.isArray(machine.load) ? finite(machine.load[0]) : null,
    disk: finite(disk),
    gpus: Array.isArray(machine.gpus) ? machine.gpus.map((gpu) => finite(gpu?.util)) : [],
  };
}
