import type { HostContext } from "../host-types.ts";
import type { PeerMessage } from "../../../../shared/session-messages/message-types.ts";
import { formatPeerMessages } from "../../../../shared/session-messages/format-peer-messages.ts";
import { refused } from "./refused.ts";
import { admit } from "../input/admit-input.ts";

export async function flushPeerInbox(ctx: HostContext, delivery: "steer" | "followUp" = "steer"): Promise<void> {
  if (ctx.flushingInbox) {
    await ctx.flushingInbox;
    return flushPeerInbox(ctx, delivery);
  }
  if (!ctx.inbox.length || ctx.pendingCompaction || ctx.active?.kind === "compact" || ctx.active?.cancelled || ctx.closing) return;
  const queued = ctx.active !== undefined;
  const batch: PeerMessage[] = [];
  ctx.inbox = ctx.inbox.filter((entry) => {
    if (queued && entry.delivery !== delivery) return true;
    batch.push(entry.message);
    return false;
  });
  const [first] = batch;
  if (!first) return;
  ctx.inboxChars -= batch.reduce((chars, message) => chars + message.body.length, 0);
  const flushing = Promise.withResolvers<void>();
  ctx.flushingInbox = flushing.promise;
  const request = {
    requestId: `session-message:${first.messageId}`,
    message: formatPeerMessages(batch),
    ...(queued ? { queue: delivery } : {}),
  };
  const refuse = (error: unknown) => refused(ctx, batch, error);
  try {
    const admission = admit(ctx, request, (disposition) => {
      if (disposition === "handled") refuse("handled by an input extension");
    });
    if (!admission.accepted) { refuse(admission.error); return; }
    for (const { messageId } of batch.slice(1)) ctx.active?.requestIds.add(`session-message:${messageId}`);
    if (queued) await admission.invocation;
    else void admission.invocation.catch(refuse);
  } catch (error) { refuse(error); }
  finally {
    ctx.flushingInbox = undefined;
    flushing.resolve();
  }
}
