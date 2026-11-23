import type { HostContext, Operation } from "../host-types.ts";

export function clearQueue(ctx: HostContext, operation?: Operation): readonly string[] {
  const queue = ctx.session.clearQueue();
  const messages = [...queue.steering, ...queue.followUp];
  if (operation && messages.length > 0) operation.unknown = true;
  return messages;
}
