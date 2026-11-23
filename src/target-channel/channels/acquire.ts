import type { LeaseRecord, TargetLease } from "../lease/lease-types.ts";
import type { LeaseContext } from "../lease/lease-state.ts";
import { request } from "../lease/request.ts";
import { subscribe } from "../lease/subscribe-events.ts";
import { onState } from "../lease/subscribe-state.ts";
import { state } from "../lease/read-state.ts";
import { release } from "../lease/release.ts";
import type { ChannelsContext } from "./channel-state.ts";
import { waitForLink } from "./availability/wait-for-link.ts";
import { snapshot } from "./state/format-channel-state.ts";

export function acquire(ctx: ChannelsContext, id: string): TargetLease {
  let machine = ctx.machines.get(id);
  if (!machine || machine.state === "error") {
    machine = { id, leases: new Set(), waiters: new Set(), state: "stopped", error: undefined, failure: undefined, link: undefined,
      abort: undefined, generation: 0 };
    ctx.machines.set(id, machine);
  }
  const target = machine;
  const lease: LeaseRecord = { abort: new AbortController(), events: new Set(), states: new Set() };
  const leaseCtx: LeaseContext = {
    target, lease, released: undefined,
    stop: ctx.stop, waitForLink, notify: ctx.notify, snapshot,
  };
  target.leases.add(lease);
  if (target.state === "stopped") void ctx.start(target);
  return {
    processWindow: ctx.options.processWindow,
    request: (mod, op, args) => request(leaseCtx, mod, op, args),
    subscribe: (listener) => subscribe(leaseCtx, listener),
    onState: (listener) => onState(leaseCtx, listener),
    state: () => state(leaseCtx),
    release: () => release(leaseCtx),
  };
}
