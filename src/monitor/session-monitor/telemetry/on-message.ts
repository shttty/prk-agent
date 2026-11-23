import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import type { CollectorMessage } from "../../telemetry/telemetry-types.ts";
import { publish } from "../subscriptions/publish.ts";

export function onMessage(ctx: MonitorContext, machine: MachineRecord, message: CollectorMessage): void {
  const at = ctx.now();
  if (message.t === "machine") {
    machine.history.push(at, message);
    for (const [sessionId, rec] of ctx.sessions) {
      if (rec.machine !== machine.id) continue;
      rec.sample = { at, value: message };
      publish(ctx, sessionId);
    }
    return;
  }
  if (message.t === "disk") {
    // The tick's disk figure of a watched directory. The git state keeps its own sample time: a disk figure does not make it younger.
    for (const [sessionId, rec] of ctx.sessions) {
      if (rec.machine !== machine.id || rec.cwd !== message.dir || !rec.dir) continue;
      rec.dir = { at: rec.dir.at, value: { ...rec.dir.value, disk: message.disk } };
      publish(ctx, sessionId);
    }
    return;
  }
  if (message.t !== "dir") return;
  for (const [sessionId, rec] of ctx.sessions) {
    if (rec.machine !== machine.id || rec.cwd !== message.dir) continue;
    rec.dir = { at, value: message };
    rec.agent = message.git ? undefined : { at, value: ctx.deps.agentChanges(sessionId) };
    publish(ctx, sessionId);
  }
}
