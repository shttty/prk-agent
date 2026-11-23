import type { HostContext, Operation, OperationCompletionStatus, OperationCompletion } from "../host-types.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeSessionFailure } from "../../../diagnostics/session-errors/describe-session-failure.ts";
import { summarizeSessionFailure } from "../../../diagnostics/session-errors/summarize-session-failure.ts";
import { discardInbox } from "../inbox/discard-inbox.ts";
import { discardQueued } from "./discard-queued-input.ts";
import { recordUnprocessed } from "../inbox/record-unprocessed-peers.ts";
import { setState } from "./set-host-state.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { flushPeerInbox } from "../inbox/flush-peer-inbox.ts";
import { retainQueuedPeers } from "../inbox/retain-queued-peers.ts";

export function finish(ctx: HostContext, operation: Operation): void {
  if (ctx.active !== operation || operation.pending) return;
  if (operation.cancelled) {
    const reason = operation.cancelReason ?? "SDK aborted the previous run.";
    if (operation.preservePeerInbox) retainQueuedPeers(ctx, operation);
    else {
      discardInbox(ctx, reason);
      discardQueued(ctx, operation, reason);
    }
    recordUnprocessed(ctx, operation, reason);
  }
  if (ctx.session.pendingMessageCount > 0) {
    operation.unknown = true;
    operation.error ??= "SDK became idle with residual queued input; execution disposition is unknown.";
  }
  const sessionDetail = operation.error ? describeSessionFailure(ctx.session, operation.error, operation.messageCount, ctx.sessionOptions) : undefined;
  const detailedError = operation.error
    ? sessionDetail ? `${operation.error}\n\n${sessionDetail}` : operation.error
    : undefined;
  const status: OperationCompletionStatus = operation.userCancelled ? "cancelled"
    : operation.cancelled
      ? (operation.aborted && !operation.error && !operation.unknown ? "cancelled" : "unknown")
      : operation.unknown ? "unknown" : operation.error ? "failed" : "completed";
  const publicError = operation.error ? summarizeSessionFailure(ctx.session, operation.error, operation.messageCount, ctx.sessionOptions) : undefined;
  if (status === "failed" || status === "unknown") {
    const detail = detailedError ?? "No captured exception; execution disposition is unknown.";
    console.error(`[${new Date().toISOString()}] Gateway operation ${operation.id} ${status}; session ${ctx.sessionId}.\n${boundedError(detail, ctx.sessionOptions.errorDetailChars)}`);
  }
  const completion: OperationCompletion = {
    operationId: operation.id,
    status,
    requestIds: [...operation.requestIds],
    ...(publicError && status !== "cancelled" ? { error: publicError } : {}),
    ...(operation.returnedMessages.length ? { returnedMessages: [...operation.returnedMessages] } : {}),
  };
  ctx.active = undefined;
  if (completion.requestIds.length) {
    ctx.recent = [...ctx.recent, completion].slice(-ctx.sessionOptions.recentOperationsMax);
    // A failed or unknown outcome belongs to this operation; the session stays usable for the next input.
    setState(ctx, "idle");
    emit(ctx, "operation_completed", { operationId: operation.id, details: { ...completion } });
  }
  operation.completion.resolve(structuredClone(completion));
  if (ctx.inbox.length && !ctx.closing) void flushPeerInbox(ctx);
}
