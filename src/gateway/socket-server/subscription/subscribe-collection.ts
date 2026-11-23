import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { GatewayCollectionEvent } from "../../instance-environments/environment-types.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export function subscribeCollection(ctx: PeerContext, respond: Respond, id: number): void {
  const { host, limits } = ctx.listener;
  const { socket } = ctx;
  (0, ctx.unsubscribeSessions)?.();
  ctx.unsubscribeSessions = undefined;
  let ready = false;
  let buffered: GatewayCollectionEvent[] = [];
  let bytes = 0;
  const unsubscribe = host.subscribeSessions((event) => {
    if (!ready) {
      bytes += Buffer.byteLength(JSON.stringify(event));
      if (bytes > limits.outputBytes) socket.destroy();
      else buffered.push(event);
    } else writeFrame(socket, { v: 1, collection: event }, limits.outputBytes, limits.outputBytes);
  });
  ctx.unsubscribeSessions = unsubscribe;
  if (!respond(id, host.workbench())) {
    unsubscribe(); ctx.unsubscribeSessions = undefined; buffered = []; return;
  }
  // Lifecycle events have no global sequence: the workbench snapshot in the
  // reply is authoritative and a buffered event may repeat what it showed.
  ready = true;
  for (const event of buffered) writeFrame(socket, { v: 1, collection: event }, limits.outputBytes, limits.outputBytes);
  buffered = [];
  if (socket.destroyed) unsubscribe();
}
