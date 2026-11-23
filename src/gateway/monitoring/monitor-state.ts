import type { createMonitorService } from "../../monitor/session-monitor/assemble-session-monitor.ts";

export interface MonitorState {
  monitor: ReturnType<typeof createMonitorService>;
  unsubscribeMonitor: () => void;
  kernelWatches: Map<string, { readonly kernel: object; unsubscribe(): void }>;
  monitorQueued: boolean;
}
