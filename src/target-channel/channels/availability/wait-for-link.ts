import { errorOf } from "../../connection-error/normalize-error.ts";
import type { RuntimeLink } from "../../runtime-link/link-types.ts";
import type { LinkWaiterContext } from "../channel-state.ts";
import type { MachineRecord } from "../channel-types.ts";
import { resolve } from "./resolve-link-waiter.ts";
import { reject } from "./reject-link-waiter.ts";
import { abort } from "./abort-link-waiter.ts";

export function waitForLink(machine: MachineRecord, signal: AbortSignal): Promise<RuntimeLink> {
  if (signal.aborted) return Promise.reject(errorOf(signal.reason));
  if (machine.state === "ok" && machine.link) return Promise.resolve(machine.link);
  if (machine.state === "error" || machine.state === "stopped") {
    return Promise.reject(machine.failure ?? new Error(machine.error ?? "Target channel stopped."));
  }
  const result = Promise.withResolvers<RuntimeLink>();
  const ctx: LinkWaiterContext = {
    machine, signal, result,
    waiter: {
      resolve: (link) => resolve(ctx, link),
      reject: (error) => reject(ctx, error),
    },
    abort: () => abort(ctx),
  };
  machine.waiters.add(ctx.waiter);
  signal.addEventListener("abort", ctx.abort, { once: true });
  return result.promise;
}
