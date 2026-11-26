import type { HostContext, Operation } from "../host-types.ts";
import { parsePeerMessages } from "../../../../shared/session-messages/parse-peer-messages.ts";
import { recordDiscard } from "./record-discarded-peer.ts";

export function recordUnprocessed(ctx: HostContext, operation: Operation, reason: string): void {
  const messages = ctx.session.messages;
  let start = operation.messageCount;
  for (let index = messages.length - 1; index >= start; index--) {
    const message = messages[index];
    if (message?.role === "assistant" && message.stopReason === "stop") { start = index + 1; break; }
  }
  for (let index = start; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const text = typeof message.content === "string" ? message.content
      : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const peers = parsePeerMessages(text);
    if (peers) recordDiscard(ctx, peers, reason, "delivered-but-unprocessed");
  }
}
