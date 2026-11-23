import type { SessionMonitor } from "../session-monitor-types.ts";

export const NO_ALERTS: SessionMonitor["alerts"] = Object.freeze({ kernel: false, oom: false, memory: false });
