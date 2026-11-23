import type { MachineRecord, TargetState } from "../channel-types.ts";

export const snapshot = (machine: MachineRecord): TargetState => ({
  state: machine.state,
  ...(machine.error === undefined ? {} : { error: machine.error }),
});
