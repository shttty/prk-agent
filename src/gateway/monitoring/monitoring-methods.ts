import type { branchOf } from "./file-changes/read-session-branch.ts";
import type { reconcileMonitor } from "./subscription/reconcile-awake-sessions.ts";
import type { monitorFocus } from "./subscription/focus-monitor.ts";
import type { monitorHistory } from "./metrics/read-monitor-history.ts";
import type { monitorDiff } from "./file-changes/read-file-diff.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface MonitoringMethods {
  branchOf: WithoutContext<typeof branchOf>;
  reconcileMonitor: WithoutContext<typeof reconcileMonitor>;
  monitorFocus: WithoutContext<typeof monitorFocus>;
  monitorHistory: WithoutContext<typeof monitorHistory>;
  monitorDiff: WithoutContext<typeof monitorDiff>;
}
