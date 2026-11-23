import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { SessionHostSnapshot } from "../../../sessions/host/host-types.ts";
import { createSessionStreamId } from "../../../sessions/host/create-stream-id.ts";

/** Stream identity and state of a session without an active host: the one allocation point of its zero-sequence stream. */
export function archivedStream(ctx: HostContext, entry: StoredSession): Pick<SessionHostSnapshot, "streamId" | "state"> {
  let streamId = ctx.views.archivedStreamIds.get(entry.sessionId);
  if (!streamId) { streamId = createSessionStreamId(); ctx.views.archivedStreamIds.set(entry.sessionId, streamId); }
  return { streamId, state: entry.sleeping ? "sleeping" : ctx.methods.unavailableSession(entry) ? "unavailable" : "closed" };
}
