import type { KernelContext } from "../kernel-state.ts";
import { runMaintenance } from "./run-maintenance.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

export async function maintain(ctx: KernelContext, command: Record<string, unknown>) {
  const process = ctx.process;
  if (ctx.closed || ctx.handoff || ctx.changingLanguage || !process || process.retired || ctx.cells.size || ctx.maintenance || ctx.replacing || ctx.starting) {
    throw Object.assign(new WireError("BUSY", "Kernel maintenance requires an idle connected kernel."), { transient: true });
  }
  const { outcome, output } = await runMaintenance(ctx, process, command);
  if (command.kind === "delete" && outcome === "error") throw new WireError("INVALID_REQUEST", "Variable deletion failed: only an existing exact user name may be deleted; internal/helper names are excluded.");
  if (outcome !== "ok") throw new Error(`Kernel maintenance failed: ${output}`);
  return ctx.snapshot;
}
