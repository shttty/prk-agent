import type { MachineRecord } from "../channel-types.ts";

export const isCurrentGeneration = (machine: MachineRecord, generation: number): boolean => generation === machine.generation && machine.leases.size > 0;
