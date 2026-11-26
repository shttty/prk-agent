import type { HostContext, Operation } from "../host-types.ts";
import { parsePeerMessages } from "../../../../shared/session-messages/parse-peer-messages.ts";
import { recordDiscard } from "./record-discarded-peer.ts";

/** clearQueue transfers ownership back from Pi; consumed transcript messages are never replayed. */
export function retainQueuedPeers(ctx: HostContext, operation: Operation): void {
  const queue = ctx.session.clearQueue();
  let retained = false;
  for (const text of [...queue.steering, ...queue.followUp]) {
    const peers = parsePeerMessages(text);
    if (peers?.every((message) => message.arrival !== undefined)) {
      if (operation.preservePeerInbox) {
        for (const message of peers) {
          ctx.inbox.push({ message, delivery: "steer" });
          ctx.inboxChars += message.body.length;
        }
        retained = true;
      }
      else recordDiscard(ctx, peers, operation.cancelReason ?? "User cancelled the previous run.", "never-delivered");
    } else operation.returnedMessages.push(text);
  }
  if (retained) ctx.inbox.sort((left, right) => left.message.arrival! - right.message.arrival!);
}
