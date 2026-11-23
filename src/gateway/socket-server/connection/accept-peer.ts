import type { Socket } from "node:net";
import type { ListenerContext } from "../listener-state.ts";
import type { PeerContext } from "./peer-state.ts";
import { readFrames } from "../../socket-channel/read-frames.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";
import { endSocket } from "../../socket-channel/end-socket.ts";
import { failure } from "../../wire/serialize-failure.ts";
import { observeRouteClosure } from "../subscription/observe-route-closure.ts";
import { releasePeer } from "./release-peer.ts";
import { sendResponse } from "../protocol/send-response.ts";
import { receiveRequest } from "../protocol/receive-request.ts";

export function acceptPeer(listener: ListenerContext, socket: Socket): void {
  const { peers, gateway, limits } = listener;
  if (listener.stopping || peers.size >= gateway.connectionsMax) { socket.destroy(); return; }
  peers.add(socket);
  // Route closure observation is separate from an optional collection stream.
  const ctx: PeerContext = {
    listener, socket,
    unsubscribeHost: undefined,
    unsubscribeSessions: undefined,
    unsubscribeTerminal: undefined,
    subscribedSessionId: undefined,
    unsubscribeRoutes: undefined,
    lastId: 0,
    pending: 0,
  };
  ctx.unsubscribeRoutes = observeRouteClosure(ctx);
  socket.on("error", () => { socket.destroy(); });
  socket.once("close", () => releasePeer(ctx));
  const respond = (id: number, result: unknown) => sendResponse(ctx, id, result);
  readFrames(socket, limits.inputBytes, (value) => receiveRequest(ctx, respond, value),
    (error) => { writeFrame(socket, failure(null, error), limits.outputBytes, limits.outputBytes); endSocket(socket, gateway.socketCloseGraceMs); });
}
