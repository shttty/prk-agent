import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { SessionRecovery } from "../../../sessions/collection/collection-types.ts";
import type { CreatedSession } from "../session-view-types.ts";

export function historicalResult(ctx: HostContext, entry: StoredSession, recovery: SessionRecovery): CreatedSession {
    return { session: ctx.methods.managedSessionSnapshot(entry, recovery), snapshot: ctx.methods.archivedSnapshot(entry) };
  }
