import type { ChannelsContext } from "../channel-state.ts";
import type { MachineRecord } from "../channel-types.ts";
import { snapshot } from "./format-channel-state.ts";
import { notify } from "./notify-state.ts";

export function publish(ctx: ChannelsContext, machine: MachineRecord): void {
  if (machine.state === "ok" && machine.link) {
    for (const waiter of machine.waiters) waiter.resolve(machine.link);
  } else if (machine.state === "error" || machine.state === "stopped") {
    for (const waiter of machine.waiters) waiter.reject(machine.failure ?? new Error(machine.error ?? "Target channel stopped."));
  }
  const state = snapshot(machine);
  for (const lease of [...machine.leases]) for (const listener of [...lease.states]) notify(ctx, listener, state);
}
