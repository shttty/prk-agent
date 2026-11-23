import type { HostContext } from "../host-types.ts";
import { recordDiscard } from "./record-discarded-peer.ts";

export function discardInbox(ctx: HostContext, reason: string): void {
  recordDiscard(ctx, ctx.inbox.map(({ message }) => message), reason, "never-delivered");
  ctx.inbox.length = 0;
  ctx.inboxChars = 0;
}
