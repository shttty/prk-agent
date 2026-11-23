import type { PeerDelivery, PeerMessage } from "../../../../shared/session-messages/message-types.js";
import type { PeerReceipt } from "../../../sessions/host/host-types.ts";
import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function receivePeer(ctx: HostBindingContext, message: PeerMessage, delivery?: PeerDelivery): Promise<PeerReceipt> {
  return ctx.parent.methods.admitInput(ctx.sessionId, () => requireSource(ctx).receivePeer(message, delivery));
}
