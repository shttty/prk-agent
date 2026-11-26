import type { MachineSample } from "../../../src/gateway/wire/web-types.ts";
import { machineMemory } from "./machine-memory.ts";
import { percent } from "./percent.ts";

export function machineFacts(machine: MachineSample | undefined): [string, number | null][] {
  if (!machine) return [];
  const memory = machineMemory(machine);
  const { gpus } = machine;
  return [["CPU", percent(machine.cpu.pct)], ["内存", memory ? percent(memory.percent) : null], ...gpus.map((gpu, index): [string, number | null] => [gpus.length > 1 ? `GPU${index}` : "GPU", percent(gpu.util)])];
}
