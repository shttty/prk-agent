import type { MonitorContext } from "./monitor-state.ts";
import type { MonitoredSession } from "./session-monitor-types.ts";
import { publish } from "./subscriptions/publish.ts";
import { record } from "./sessions/get-session-record.ts";
import { machineOf } from "./connection/get-machine.ts";
import { stop } from "./connection/stop.ts";
import { ensure } from "./connection/ensure.ts";
import { sync } from "./sampling/sync.ts";

export function setSessions(ctx: MonitorContext, desired: readonly MonitoredSession[]): void {
  if (ctx.closed || !ctx.options.enabled) return;
  const wanted = new Map(desired.map((session) => [session.sessionId, session]));
  const touched = new Set<string>();
  const changed: string[] = [];
  for (const [sessionId, rec] of ctx.sessions) {
    if (rec.machine !== undefined && !wanted.has(sessionId)) {
      touched.add(rec.machine);
      rec.machine = undefined;
      rec.cwd = undefined;
      rec.processes = []; rec.processesTruncated = false;
      clearTimeout(rec.refreshTimer);
      ctx.leases.delete(sessionId);
      publish(ctx, sessionId);
    }
  }
  const joined = new Set<string>();
  for (const session of desired) {
    const rec = record(ctx, session.sessionId);
    if (rec.machine !== session.machine || rec.cwd !== session.cwd) {
      if (rec.machine !== undefined) touched.add(rec.machine);
      rec.machine = session.machine;
      if (rec.historyMachine !== session.machine) { rec.sample = undefined; rec.processes = []; rec.processesTruncated = false; }
      rec.historyMachine = session.machine;
      rec.cwd = session.cwd;
      // A moved cwd or machine invalidates the old change numbers; machine samples stay until replaced.
      rec.dir = undefined;
      rec.agent = undefined;
      joined.add(session.machine);
      changed.push(session.sessionId);
    }
    touched.add(session.machine);
  }
  for (const id of touched) {
    const machine = machineOf(ctx, id);
    if (![...ctx.sessions.values()].some((rec) => rec.machine === id)) { if (machine.state !== "stopped") stop(ctx, machine); continue; }
    // Only a newly admitted session may acquire a fresh generation after failure.
    ensure(ctx, machine, joined.has(id));
    sync(ctx, machine);
  }
  for (const sessionId of changed) publish(ctx, sessionId);
}
