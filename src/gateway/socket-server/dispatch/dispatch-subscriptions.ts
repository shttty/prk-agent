import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import { subscribeSession } from "../subscription/subscribe-session.ts";
import { subscribeCollection } from "../subscription/subscribe-collection.ts";

export async function dispatchSubscriptions(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
      if (method === "subscribe") { subscribeSession(ctx, respond, id, params.sessionId as string); return; }
      if (method === "unsubscribe") {
        (0, ctx.unsubscribeHost)?.(); ctx.unsubscribeHost = undefined;
        ctx.subscribedSessionId = undefined;
        respond(id, { unsubscribed: true }); return;
      }
      if (method === "subscribeSessions") { subscribeCollection(ctx, respond, id); return; }
      if (method === "unsubscribeSessions") {
        (0, ctx.unsubscribeSessions)?.(); ctx.unsubscribeSessions = undefined;
        respond(id, { unsubscribed: true }); return;
      }
}
