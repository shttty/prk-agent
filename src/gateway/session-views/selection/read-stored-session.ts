import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import { WireError } from "../../wire/create-error.ts";

export function stored(ctx: HostContext, sessionId: string): StoredSession {
    const entry = ctx.host.history.get(sessionId);
    if (!entry) throw new WireError("NOT_FOUND", "Session history is not managed by this Gateway.");
    return entry;
  }
