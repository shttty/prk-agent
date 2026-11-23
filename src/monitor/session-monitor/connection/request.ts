import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";

export function request(ctx: MonitorContext, machine: MachineRecord, op: string, args: Record<string, unknown>): void {
  void machine.lease?.request("monitor", op, args).catch((error: unknown) => {
    ctx.log(`monitor ${machine.id}: ${error instanceof Error ? error.message : String(error)}`);
  });
}
