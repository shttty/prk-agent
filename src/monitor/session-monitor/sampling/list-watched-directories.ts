import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";

export function watchedDirs(ctx: MonitorContext, machine: MachineRecord): string[] {
  return [...new Set([...ctx.sessions.values()].flatMap((rec) => rec.machine === machine.id && rec.cwd !== undefined ? [rec.cwd] : []))].sort();
}
