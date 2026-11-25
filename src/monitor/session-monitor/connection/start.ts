import { Value } from "typebox/value";
import { processSample } from "../../telemetry/process-types.ts";
import type { MonitorContext } from "../monitor-state.ts";
import type { MachineRecord } from "../session-monitor-types.ts";
import type { CollectorMessage } from "../../telemetry/telemetry-types.ts";
import { publishMachine } from "../subscriptions/publish-machine.ts";
import { onMessage } from "../telemetry/on-message.ts";
import { sync } from "../sampling/sync.ts";

export function start(ctx: MonitorContext, machine: MachineRecord): void {
  const lease = ctx.deps.channels.acquire(machine.id);
  machine.lease = lease;
  const offMessage = lease.subscribe((message) => {
    if (message.mod === "customMetrics" && machine.custom.receive(message, ctx.now())) publishMachine(ctx, machine);
    if (message.mod === "monitor") {
      const { mod: _mod, ...sample } = message;
      if (sample.t === "processes") {
        if (!Value.Check(processSample, sample)) { ctx.log(`monitor ${machine.id}: invalid process sample`); return; }
        onMessage(ctx, machine, sample);
      } else onMessage(ctx, machine, sample as unknown as CollectorMessage);
    }
  });
  const offState = lease.onState((state) => {
    machine.state = state.state;
    machine.error = state.error;
    machine.intervalMs = undefined;
    machine.watched = "";
    machine.custom.reset();
    if (state.state === "ok") sync(ctx, machine);
    else for (const [sessionId, rec] of ctx.sessions) {
      if (rec.machine !== machine.id) continue;
      const hadDetached = rec.processes.some((row) => row.ownership === "detached");
      rec.processes = []; rec.processesTruncated = false;
      if (hadDetached) ctx.deps.onDetachedChanged(sessionId, false);
    }
    publishMachine(ctx, machine);
  });
  machine.unsubscribe = () => { offMessage(); offState(); };
}
