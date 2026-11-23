import type { HostContext } from "../host/host-state.ts";
import { createAgentMessaging } from "../../sessions/peer-messaging/assemble-peer-messaging.ts";

export function openPeerMessages(ctx: HostContext): void {
  ctx.peerMessages.messaging = createAgentMessaging({
    // Only reachable sessions: a sleeping session wakes on delivery.
    list: () => ctx.methods.managed().filter(({ state }) => state !== "closed" && state !== "closing" && state !== "unavailable")
      .map(({ sessionId, label, state, derivation, projectId }) => ({
        sessionId, label, state,
        owner: derivation?.owner ?? null,
        ...(derivation ? { createdBy: derivation.createdBy } : {}),
        ...(derivation?.pendingOwner ? { pendingOwner: derivation.pendingOwner } : {}),
        ...(derivation ? { derivation } : {}),
        ...(projectId === undefined ? {} : { projectId }),
        ...ctx.methods.sessionRoles(sessionId),
      })),
    canControl(actor, target) {
      const peers = ctx.methods.managed();
      const from = peers.find(({ sessionId }) => sessionId === actor);
      const to = peers.find(({ sessionId }) => sessionId === target);
      return !!from && !!to && ctx.methods.canControlSession(from.sessionId, to.sessionId);
    },
    async deliver(id, message, delivery) {
      if (ctx.lifecycle.closing) throw new Error("Gateway is shutting down; message was not accepted.");
      const target = ctx.methods.managed().find(({ sessionId }) => sessionId === id);
      if (!target) throw new Error("Recipient session is no longer reachable; message was not accepted.");
      return ctx.methods.sessionHost(target.sessionId).receivePeer(message, delivery);
    },
  }, ctx.host.config.session);
}
