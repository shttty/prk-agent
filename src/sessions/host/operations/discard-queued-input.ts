import type { HostContext, Operation } from "../host-types.ts";
import { parsePeerMessages } from "../../../../shared/session-messages/parse-peer-messages.ts";
import { clearQueue } from "./clear-sdk-queue.ts";
import { recordDiscard } from "../inbox/record-discarded-peer.ts";

export function discardQueued(ctx: HostContext, operation: Operation | undefined, reason: string): readonly string[] {
  const returnedMessages = operation?.returnedMessages ?? [];
  for (const text of clearQueue(ctx, operation)) {
    const peers = parsePeerMessages(text);
    if (peers) recordDiscard(ctx, peers, reason, "never-delivered");
    else returnedMessages.push(text);
  }
  return returnedMessages;
}
