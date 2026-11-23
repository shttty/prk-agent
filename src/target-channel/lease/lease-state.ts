import type { MachineRecord, TargetState } from "../channels/channel-types.ts";
import type { RuntimeLink } from "../runtime-link/link-types.ts";
import type { LeaseRecord } from "./lease-types.ts";

export interface LeaseContext {
  readonly target: MachineRecord;
  readonly lease: LeaseRecord;
  released: Promise<void> | undefined;
  stop(machine: MachineRecord): Promise<void>;
  waitForLink(machine: MachineRecord, signal: AbortSignal): Promise<RuntimeLink>;
  notify(listener: (state: TargetState) => void, state: TargetState): void;
  snapshot(machine: MachineRecord): TargetState;
}
