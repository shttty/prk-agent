import { runtimeLink } from "../../runtime-link/assemble-runtime-link.ts";
import type { ChannelsContext } from "../channel-state.ts";
import type { MachineRecord } from "../channel-types.ts";
import { publish } from "../state/publish-state.ts";
import { isCurrentGeneration } from "./is-current-generation.ts";

export async function start(ctx: ChannelsContext, machine: MachineRecord): Promise<void> {
  const { deps, options, log } = ctx;
  if (!machine.leases.size) return;
  const generation = ++machine.generation;
  const current = (): boolean => isCurrentGeneration(machine, generation);
  const abort = new AbortController();
  machine.abort = abort;
  machine.state = "starting";
  publish(ctx, machine);
  if (!current()) return;
  try {
    const opened = await deps.open(machine.id, abort.signal, options.processWindow);
    if (!current() || abort.signal.aborted) {
      await opened.transport.close();
      return;
    }
    const link = runtimeLink(opened.transport, options.startTimeoutMs, (event) => {
      if (!current()) return;
      for (const lease of [...machine.leases]) for (const listener of [...lease.events]) {
        try { listener(event); } catch { log("target channel event listener failed"); }
      }
    }, (reason) => { if (current()) ctx.fail(machine, reason); }, options.processWindow);
    machine.link = link;
    await link.start(opened.command, abort.signal);
    if (!current()) return;
    machine.abort = undefined;
    machine.state = "ok";
    machine.error = undefined;
    machine.failure = undefined;
    publish(ctx, machine);
  } catch (error) {
    if (current()) ctx.fail(machine, error);
  }
}
