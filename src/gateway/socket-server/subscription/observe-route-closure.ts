import type { PeerContext } from "../connection/peer-state.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export function observeRouteClosure(ctx: PeerContext): () => void {
  const { host, limits } = ctx.listener;
  const { socket } = ctx;
  return host.subscribeSessions((event) => {
    if (event.sessionId !== ctx.subscribedSessionId) return;
    if (["session_closed", "session_archived"].includes(event.type)) {
      if (!ctx.unsubscribeSessions) writeFrame(socket, { v: 1, collection: event }, limits.outputBytes, limits.outputBytes);
      (0, ctx.unsubscribeHost)?.(); ctx.unsubscribeHost = undefined;
      ctx.subscribedSessionId = undefined;
    }
  });
}
