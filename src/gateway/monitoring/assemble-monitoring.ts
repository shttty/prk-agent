import { branchOf } from "./file-changes/read-session-branch.ts";
import { reconcileMonitor } from "./subscription/reconcile-awake-sessions.ts";
import { monitorFocus } from "./subscription/focus-monitor.ts";
import { monitorHistory } from "./metrics/read-monitor-history.ts";
import { monitorDiff } from "./file-changes/read-file-diff.ts";
import type { HostContext } from "../host/host-state.ts";
import type { MonitoringMethods } from "./monitoring-methods.ts";

export function assembleMonitoring(ctx: HostContext): MonitoringMethods {
  return {
    branchOf: branchOf.bind(undefined, ctx),
    reconcileMonitor: reconcileMonitor.bind(undefined, ctx),
    monitorFocus: monitorFocus.bind(undefined, ctx),
    monitorHistory: monitorHistory.bind(undefined, ctx),
    monitorDiff: monitorDiff.bind(undefined, ctx),
  };
}
