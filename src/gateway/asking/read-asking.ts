import type { HostContext } from "../host/host-state.ts";
import type { StoredSession } from "../../sessions/history/history-types.ts";

export function askWaiting(ctx: HostContext, entry: StoredSession): boolean {
    if (entry.sleeping) return false;
    const runtime = ctx.host.collection.get(entry.sessionId);
    return runtime?.extensionUi.asking() ?? false;
  }
