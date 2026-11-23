import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { MonitorHistory } from "../../../monitor/sample-history/sample-history-types.ts";

export function monitorHistory(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["monitorHistory"]>[0]): MonitorHistory { return ctx.monitoring.monitor.history(ctx.methods.storedSession(sessionId).target); }
