import type { MachineRecord } from "../channel-types.ts";
import type { RuntimeLink } from "../../runtime-link/link-types.ts";

export function teardown(machine: MachineRecord): RuntimeLink | undefined {
  machine.generation++;
  machine.abort?.abort(new Error("Target channel stopped."));
  machine.abort = undefined;
  const link = machine.link;
  machine.link = undefined;
  return link;
}
