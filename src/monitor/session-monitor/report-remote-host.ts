import type { MonitorContext } from "./monitor-state.ts";
import type { RemoteHostMonitor } from "../telemetry/telemetry-types.ts";
import { record } from "./sessions/get-session-record.ts";
import { publish } from "./subscriptions/publish.ts";

export function reportRemoteHost(ctx: MonitorContext, sessionId: string, host: RemoteHostMonitor | null): void {
    if (ctx.closed) return;
    record(ctx, sessionId).remoteHost = host;
    publish(ctx, sessionId);
  }
