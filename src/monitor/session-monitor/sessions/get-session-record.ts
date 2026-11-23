import type { MonitorContext } from "../monitor-state.ts";
import type { SessionRecord } from "../session-monitor-types.ts";
import { NO_ALERTS } from "../telemetry/session-monitor-constants.ts";

export function record(ctx: MonitorContext, sessionId: string): SessionRecord {
  let found = ctx.sessions.get(sessionId);
  if (!found) {
    found = { machine: undefined, historyMachine: undefined, cwd: undefined, alerts: NO_ALERTS, sample: undefined, dir: undefined, agent: undefined, refreshTimer: undefined, remoteHost: null };
    ctx.sessions.set(sessionId, found);
  }
  return found;
}
