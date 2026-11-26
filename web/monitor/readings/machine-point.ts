import type { MachinePoint, MachineSampleAt } from "./monitor-types.ts";
import { machineMemory } from "./machine-memory.ts";

const finite = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export function machinePoint({ at, value: machine }: MachineSampleAt): MachinePoint {
  const memory = machineMemory(machine);
  const disk = machine.disk && machine.disk.total > 0 ? ((machine.disk.total - machine.disk.free) / machine.disk.total) * 100 : null;
  return {
    t: at,
    cpu: finite(machine.cpu.pct),
    mem: memory ? memory.percent : null,
    load: finite(machine.load?.[0]),
    disk: finite(disk),
    gpus: machine.gpus.map((gpu) => finite(gpu.util)),
  };
}
