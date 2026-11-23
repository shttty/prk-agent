import type { HostContext, Operation } from "../host-types.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { setState } from "./set-host-state.ts";
import { discardInbox } from "../inbox/discard-inbox.ts";
import { discardQueued } from "./discard-queued-input.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { settle } from "./settle-operation.ts";
import { retainQueuedPeers } from "../inbox/retain-queued-peers.ts";

export function requestCancel(ctx: HostContext, operation: Operation, reason = "User cancelled the previous run.", preservePeers = false): void {
  if (operation.cancelled) {
    if (!preservePeers && operation.preservePeerInbox) {
      operation.preservePeerInbox = false;
      operation.cancelReason = reason;
      discardInbox(ctx, reason);
      discardQueued(ctx, operation, reason);
    }
    return;
  }
  operation.cancelled = true;
  operation.preservePeerInbox = preservePeers;
  operation.cancelReason = reason;
  setState(ctx, "cancel_requested");
  ctx.options.extensionUi?.cancel(operation.userCancelled && !preservePeers ? "operation" : undefined);
  if (!operation.preservePeerInbox) discardInbox(ctx, reason);
  try {
    if (operation.preservePeerInbox) retainQueuedPeers(ctx, operation);
    else discardQueued(ctx, operation, reason);
  }
  catch (error) {
    operation.error = describeError(error, ctx.sessionOptions);
    operation.unknown = true;
  }
  emit(ctx, "operation_cancel_requested", { operationId: operation.id, details: { returnedMessages: [...operation.returnedMessages] } });
  if (operation.pythonStarted) {
    operation.unknown = true;
  }
  ctx.options.extensionHandlers?.cancel();
  const aborting = ctx.session.abort().catch((error: unknown) => { operation.error = describeError(error, ctx.sessionOptions); });
  operation.aborting = aborting;
  void aborting.then(() => settle(ctx, operation));
}
