import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { FileDiff } from "../../../monitor/session-monitor/session-monitor-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";

export function monitorDiff(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["monitorDiff"]>[0], path: Parameters<GatewaySessionHost["monitorDiff"]>[1]): Promise<FileDiff> {
      return ctx.monitoring.monitor.diff(ctx.methods.storedSession(sessionId).sessionId, path).catch((error: unknown) => {
        throw new WireError("UNAVAILABLE", boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars));
      });
    }
