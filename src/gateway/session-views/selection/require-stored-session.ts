import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { readSessionDerivation } from "../readability/read-session-derivation.ts";

export function storedSession(ctx: HostContext, sessionId: string): StoredSession {
    const entry = ctx.methods.stored(sessionId);
    readSessionDerivation(ctx, entry);
    if (entry.archived) throw new WireError("NOT_FOUND", "Session is archived; unarchive it first.");
    return entry;
  }
