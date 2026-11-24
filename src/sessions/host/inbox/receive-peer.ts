import type { HostContext, PeerReceipt } from "../host-types.ts";
import type { PeerDelivery, PeerMessage } from "../../../../shared/session-messages/message-types.js";
import { flushPeerInbox } from "./flush-peer-inbox.ts";
import { requestCancel } from "../operations/request-cancel.ts";

export async function receivePeer(ctx: HostContext, message: PeerMessage, delivery: PeerDelivery = "steer"): Promise<PeerReceipt> {
  if (ctx.closing || ctx.closed) throw new Error("Recipient host is closed; message was not accepted.");
  if (ctx.active?.cancelled && !ctx.active.preservePeerInbox) throw new Error("Recipient cancellation is still settling; message was not accepted.");
  if (ctx.inbox.length >= ctx.sessionOptions.inboxMaxMessages) throw new Error(`Recipient inbox message cap ${ctx.sessionOptions.inboxMaxMessages} is full; message was not accepted.`);
  if (ctx.inboxChars + message.body.length > ctx.sessionOptions.inboxMaxChars) throw new Error(`Recipient inbox character cap ${ctx.sessionOptions.inboxMaxChars} would be exceeded; message was not accepted.`);
  const idle = !ctx.active && !ctx.pendingCompaction && !ctx.flushingInbox && !ctx.reloading && ctx.session.isIdle;
  ctx.inbox.push({ message: { ...message, arrival: ++ctx.peerArrival }, delivery: delivery === "followUp" ? "followUp" : "steer" });
  ctx.inboxChars += message.body.length;
  if (delivery === "abort" && ctx.active) requestCancel(ctx, ctx.active, "A controlling session interrupted the previous run.", message.sender);
  else if (!ctx.active || delivery === "followUp") void flushPeerInbox(ctx, delivery === "followUp" ? "followUp" : "steer");
  return { accepted: true, pending: ctx.inbox.length, delivery: idle && ctx.active ? "delivered" : "queued" };
}
