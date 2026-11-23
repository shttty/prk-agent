import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";

export function unavailableSession(ctx: HostContext, entry: StoredSession): boolean {
    if (entry.sleeping) return false;
    return ctx.lifecycle.recoveryStates.get(entry.sessionId)?.status === "unavailable";
  }
