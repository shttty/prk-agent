import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import { publish } from "./publish.ts";

export function publishMachine(ctx: MonitorContext, machine: MachineRecord): void {
  for (const [sessionId, rec] of ctx.sessions) if (rec.machine === machine.id) publish(ctx, sessionId);
}
