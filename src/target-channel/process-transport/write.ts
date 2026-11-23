import type { ProcessTransportState } from "./transport-state.ts";

/** SDK write acceptance is not target consumption; runtime replies acknowledge consumption. */
export function write(ctx: ProcessTransportState, data: string): void {
  if (ctx.closed !== undefined) throw new Error(ctx.closed);
  if (!ctx.process) throw new Error("Target process has not started.");
  ctx.process.write(data);
}
