import type { MonitorOptions } from "../../config/monitor/monitor-options.ts";
import type { MachineRecord, MonitorDeps, SessionMonitor, SessionRecord } from "./session-monitor-types.ts";

export interface MonitorContext {
  readonly deps: MonitorDeps;
  readonly options: MonitorOptions;
  readonly now: () => number;
  readonly log: (message: string) => void;
  readonly sessions: Map<string, SessionRecord>;
  readonly machines: Map<string, MachineRecord>;
  readonly leases: Map<string, number>;
  readonly leaseTimers: Map<string, ReturnType<typeof setTimeout>>;
  readonly listeners: Set<(sessionId: string, monitor: SessionMonitor) => void>;
  closed: boolean;
}
