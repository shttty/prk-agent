import type { HostContext, SessionHostSnapshot } from "../host-types.ts";
import { readAttention } from "../attention/read-attention.ts";
import { receivingUserText } from "./read-receiving-user-text.ts";
import { snapshotOperation } from "./format-operation.ts";

export function snapshot(ctx: HostContext, includeMessages = true): SessionHostSnapshot {
  return structuredClone({
    sessionId: ctx.sessionId,
    streamId: ctx.streamId,
    sequence: ctx.sequence,
    state: ctx.state,
    ...readAttention(ctx),
    ...(ctx.active ? { operation: snapshotOperation(ctx) } : {}),
    messages: includeMessages ? ctx.session.messages : [],
    receivingUserText: receivingUserText(ctx.session),
    queuedMessages: { steering: ctx.session.getSteeringMessages(), followUp: ctx.session.getFollowUpMessages() },
    ...(ctx.kernel ? { kernel: ctx.kernel.getSnapshot() } : {}),
    ...(ctx.options.terminals ? { terminals: ctx.options.terminals.getSnapshot() } : {}),
    recentOperations: ctx.recent,
    ...(ctx.options.extensionUi ? { extensionUi: ctx.options.extensionUi.snapshot() } : {}),
  });
}
