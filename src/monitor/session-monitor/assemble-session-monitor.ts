import type { MonitorContext } from "./monitor-state.ts";
import type { MonitorDeps, MonitorService } from "./session-monitor-types.ts";
import { view } from "./read-view.ts";
import { history } from "./history.ts";
import { setSessions } from "./set-sessions.ts";
import { focus } from "./focus.ts";
import { refresh } from "./refresh.ts";
import { reportKernel } from "./report-kernel.ts";
import { reportRemoteHost } from "./report-remote-host.ts";
import { diff } from "./diff.ts";
import { close } from "./close.ts";
import { subscribe } from "./subscribe.ts";

/** Gateway-side owner of every machine's collector and of the per-session numbers derived from it. */
export function createMonitorService(deps: MonitorDeps): MonitorService {
  const { options } = deps;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => undefined);
  const ctx: MonitorContext = {
    deps, options, now, log,
    sessions: new Map(), machines: new Map(), leases: new Map(), leaseTimers: new Map(), listeners: new Set(), closed: false,
  };
  return {
    get: view.bind(null, ctx),
    history: history.bind(null, ctx),
    setSessions: setSessions.bind(null, ctx),
    focus: focus.bind(null, ctx),
    refresh: refresh.bind(null, ctx),
    reportKernel: reportKernel.bind(null, ctx),
    reportRemoteHost: reportRemoteHost.bind(null, ctx),
    diff: diff.bind(null, ctx),
    close: close.bind(null, ctx),
    subscribe: subscribe.bind(null, ctx),
  };
}
