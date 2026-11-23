import type { ChannelsContext } from "../channel-state.ts";
import type { MachineRecord } from "../channel-types.ts";
import { teardown } from "./retire-generation.ts";
import { publish } from "../state/publish-state.ts";

export function stop(ctx: ChannelsContext, machine: MachineRecord): Promise<void> {
  const link = teardown(machine);
  machine.state = "stopped";
  machine.error = undefined;
  machine.failure = undefined;
  publish(ctx, machine);
  return link?.close() ?? Promise.resolve();
}
