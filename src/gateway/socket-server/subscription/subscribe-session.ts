import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { SessionSubscriptionContext } from "./subscription-state.ts";
import { deliver } from "./deliver.ts";

export function subscribeSession(ctx: PeerContext, respond: Respond, id: number, sessionId: string): void {
  const { host, limits } = ctx.listener;
  const { socket } = ctx;
  const target = host.session(sessionId);
  (0, ctx.unsubscribeHost)?.();
  ctx.unsubscribeHost = undefined;
  ctx.subscribedSessionId = undefined;
  const state: SessionSubscriptionContext = { socket, limits, sessionId, boundary: undefined, streamId: undefined, buffered: [], bytes: 0 };
  const subscription = target.subscribe((event) => {
    if (state.boundary === undefined) {
      state.bytes += Buffer.byteLength(JSON.stringify(event));
      if (state.bytes > limits.outputBytes) socket.destroy();
      else state.buffered.push(event);
    } else deliver(state, event);
  });
  ctx.unsubscribeHost = subscription.unsubscribe;
  if (!respond(id, subscription.snapshot)) {
    (0, ctx.unsubscribeHost)(); ctx.unsubscribeHost = undefined; state.buffered = []; return;
  }
  ctx.subscribedSessionId = sessionId;
  state.boundary = subscription.snapshot.sequence;
  state.streamId = subscription.snapshot.streamId;
  for (const event of state.buffered) deliver(state, event);
  state.buffered = [];
  if (socket.destroyed) (0, ctx.unsubscribeHost)();
}
