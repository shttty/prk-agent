import type { HostContext } from "../host/host-state.ts";
import type { SessionState } from "../../sessions/collection/collection-types.ts";
import { assembleProcessMetrics } from "../../metrics/assemble-process-metrics.ts";
import { bindSessionStates } from "../../metrics/instruments/bind-session-states.ts";

export function openMetrics(ctx: HostContext): void {
  const process = assembleProcessMetrics(ctx.host.config.metrics);
  const unbind = bindSessionStates(() => {
    const counts: Record<SessionState, number> = { idle: 0, starting: 0, running: 0, sleeping: 0, unavailable: 0, closing: 0, closed: 0 };
    for (const { state } of ctx.host.collection.snapshot()) counts[state]++;
    return counts;
  });
  ctx.metrics = { close: () => { process.close(); unbind(); } };
}
