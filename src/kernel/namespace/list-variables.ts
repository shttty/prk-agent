import type { KernelContext } from "../kernel-state.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export function variables(ctx: KernelContext) {
  if (!ctx.process || ctx.process.retired || ctx.closed || !ctx.snapshot.namespace) {
    throw new WireError("UNAVAILABLE", "An active owned kernel namespace is required; variable actions never wake a session.");
  }
  return { variables: ctx.snapshot.namespace.variables, truncated: ctx.snapshot.namespace.truncated };
}
