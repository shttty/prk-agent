import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { writeFrame } from "../../socket-channel/write-frame.ts";

export async function dispatchTerminals(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host, limits } = ctx.listener;
  const { socket } = ctx;
      if (method === "subscribeTerminal") {
        const name = params.name as string, sessionId = params.sessionId as string;
        const subscription = host.subscribeTerminal(sessionId, name, (terminal) => {
          writeFrame(socket, { v: 1, sessionId, name, terminal }, limits.outputBytes, limits.outputBytes);
        });
        (0, ctx.unsubscribeTerminal)?.();
        ctx.unsubscribeTerminal = subscription.unsubscribe;
        if (!respond(id, subscription.snapshot) || socket.destroyed) { (0, ctx.unsubscribeTerminal)(); ctx.unsubscribeTerminal = undefined; }
        return;
      }
      if (method === "unsubscribeTerminal") {
        (0, ctx.unsubscribeTerminal)?.(); ctx.unsubscribeTerminal = undefined;
        respond(id, { unsubscribed: true }); return;
      }
}
