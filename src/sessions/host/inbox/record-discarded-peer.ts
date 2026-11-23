import type { HostContext } from "../host-types.ts";
import type { PeerMessage } from "../../../../shared/session-messages/message-types.js";

export function recordDiscard(ctx: HostContext, messages: readonly Pick<PeerMessage, "sender" | "messageId">[], reason: string, disposition: "never-delivered" | "delivered-but-unprocessed"): void {
  for (const message of messages) ctx.discarded.set(message.messageId, { sender: message.sender, messageId: message.messageId, reason, disposition });
}
