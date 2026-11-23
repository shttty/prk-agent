import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import { teardown } from "./teardown.ts";
import { publishMachine } from "../subscriptions/publish-machine.ts";

export function stop(ctx: MonitorContext, machine: MachineRecord): void {
  const lease = teardown(ctx, machine);
  machine.state = "stopped";
  machine.error = undefined;
  void lease?.catch(() => ctx.log(`monitor ${machine.id}: close failed`));
  publishMachine(ctx, machine);
}
