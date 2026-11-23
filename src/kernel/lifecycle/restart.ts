import type { KernelContext } from "../kernel-state.ts";
import { replace } from "./replace.ts";

export async function restart(ctx: KernelContext) {
  if (ctx.closed || ctx.handoff || ctx.changingLanguage || ctx.cells.size || ctx.maintenance || ctx.starting || ctx.replacing) {
    throw Object.assign(new Error("Kernel restart requires idle state."), { code: "BUSY", transient: true });
  }
  await replace(ctx);
  return ctx.snapshot;
}
