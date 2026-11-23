import { machineMemory } from "./machine-memory.js";
import { percent } from "./percent.js";
export function machineFacts(machine) {
  if (!machine) return [];
  const memory = machineMemory(machine);
  const gpus = machine.gpus ?? [];
  return [["CPU", percent(machine.cpu?.pct)], ["内存", memory ? percent(memory.percent) : null], ...gpus.map((gpu, index) => [gpus.length > 1 ? `GPU${index}` : "GPU", percent(gpu.util)])];
}
