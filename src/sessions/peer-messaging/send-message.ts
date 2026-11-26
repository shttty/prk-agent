import { randomUUID } from "node:crypto";
import type { PeerDelivery, PeerMessage } from "../../../shared/session-messages/message-types.ts";
import type { MessagingContext } from "./message-types.ts";

export async function send(ctx: MessagingContext, actor: string, to: string, message: string, replyTo?: string, expectReply?: boolean, delivery: PeerDelivery = "steer") {
  const target = to.trim();
  const body = message.trim();
  const answering = replyTo?.trim() || undefined;
  if (!target) throw new Error("`to` must name a peer session id.");
  if (target === actor) throw new Error("Cannot send a message to yourself.");
  if (!body) throw new Error("Message cannot be empty.");
  if (body.length > ctx.sessionOptions.maxMessageChars) throw new Error(`Message is too long: ${body.length} chars exceeds ${ctx.sessionOptions.maxMessageChars}.`);
  if (!["steer", "followUp", "abort"].includes(delivery)) throw new Error("delivery must be steer, followUp or abort.");
  if (answering && ctx.noReply.has(answering)) {
    throw new Error(`Message ${answering} expects no reply; nothing was delivered. Continue your own work. `
      + "Send a new message without replyTo only if you have new information or a real question.");
  }
  if (answering && (ctx.answered.has(answering) || ctx.answeringNow.has(answering))) {
    throw new Error(`Message ${answering} already answered; send a new message to add more`);
  }
  const peers = ctx.env.list();
  if (!peers.some((peer) => peer.sessionId === target)) {
    throw new Error(`Unknown session "${target}": it does not exist, has ended or was deleted; nothing was delivered. Call session_list for reachable peers.`);
  }
  if (delivery === "abort" && !ctx.env.canControl?.(actor, target)) {
    throw new Error("Abort requires control authority: the recipient's owner/ancestor, root, or its project supervisor; nothing was delivered.");
  }
  const id = randomUUID();
  const wantsReply = expectReply ?? (answering === undefined ? ctx.sessionOptions.expectReplyForNewMessages : ctx.sessionOptions.expectReplyForReplies);
  const sender = peers.find((peer) => peer.sessionId === actor);
  const entry: PeerMessage = {
    label: sender?.label ?? "", sender: actor,
    messageId: id, replyTo: answering ?? "", expectReply: wantsReply, body,
  };
  if (answering) ctx.answeringNow.add(answering);
  try {
    const receipt = await ctx.env.deliver(target, entry, delivery);
    if (answering) {
      ctx.answered.add(answering);
      if (ctx.answered.size > ctx.sessionOptions.rememberedRepliesMax) ctx.answered.delete(ctx.answered.values().next().value as string);
    }
    if (!wantsReply) {
      ctx.noReply.add(id);
      if (ctx.noReply.size > ctx.sessionOptions.rememberedNoReplyMax) ctx.noReply.delete(ctx.noReply.values().next().value as string);
    }
    return { id, to: target, ...receipt, expectReply: wantsReply };
  } finally {
    if (answering) ctx.answeringNow.delete(answering);
  }
}
