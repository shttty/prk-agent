import type { HostContext } from "../../host/host-state.ts";
import type { SessionRecovery } from "../../../sessions/collection/collection-types.ts";
import { TargetUnreachableError } from "../../../target-channel/connection-error/create-target-unreachable-error.ts";

export function markUnavailable(ctx: HostContext, sessionId: string, message: string, error?: unknown): SessionRecovery {
    const recovery: SessionRecovery = { status: "unavailable", message, ...(error instanceof TargetUnreachableError ? { code: error.code } : {}) };
    ctx.lifecycle.recoveryStates.set(sessionId, recovery);
    ctx.sessionHosts.hostBindings.get(sessionId)?.refresh(true);
    ctx.methods.publish("session_recovery_failed", ctx.methods.storedSession(sessionId));
    return recovery;
  }
