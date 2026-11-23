import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import { start } from "./start.ts";
import { teardown } from "./teardown.ts";

export function ensure(ctx: MonitorContext, machine: MachineRecord, explicitAcquire: boolean): void {
  if (ctx.closed || !ctx.options.enabled) return;
  if (machine.state === "error") {
    if (!explicitAcquire) return;
    void teardown(ctx, machine)?.catch(() => ctx.log(`monitor ${machine.id}: close failed`));
  }
  if (!machine.lease) start(ctx, machine);
}
