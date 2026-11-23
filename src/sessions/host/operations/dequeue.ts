import type { HostContext, DequeueResult } from "../host-types.ts";
import { clearQueue } from "./clear-sdk-queue.ts";

export function dequeue(ctx: HostContext): DequeueResult {
  const operation = ctx.active;
  const messages = clearQueue(ctx, operation);
  const text = messages.at(-1);
  return {
    ...(operation ? { operationId: operation.id } : {}),
    status: messages.length > 0 ? "dequeued" : "not_found",
    ...(text === undefined ? {} : { text }),
    messages,
  };
}
