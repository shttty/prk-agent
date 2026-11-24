import { WireError } from "../../../gateway/wire/create-error.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import type { AcceptedSubmission, HostContext, Operation } from "../host-types.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { createOperation } from "./create-operation.ts";
import { requestCancel } from "./request-cancel.ts";
import { setState } from "./set-host-state.ts";
import { settle } from "./settle-operation.ts";

export function compact(ctx: HostContext, requestId: string, instructions?: string): AcceptedSubmission {
  const previous = ctx.active;
  if (ctx.closing || ctx.reloading || ctx.pendingCompaction || previous?.kind === "compact" || (!previous && !ctx.session.isIdle)) {
    throw new WireError("BUSY", "Session is already compacting or cannot begin compaction.");
  }
  const operation = createOperation(ctx, "compact");
  operation.requestIds.add(requestId);
  if (previous) {
    // /compact interrupts the current turn, but admission does not wait for the interrupted turn to settle.
    ctx.pendingCompaction = operation;
    void previous.completion.promise.then(() => start(ctx, operation, requestId, instructions));
    previous.userCancelled = true;
    requestCancel(ctx, previous);
  } else {
    start(ctx, operation, requestId, instructions);
  }
  return { accepted: true, requestId, operationId: operation.id, sessionId: ctx.sessionId, completion: operation.completion.promise };
}

function start(ctx: HostContext, operation: Operation, requestId: string, instructions: string | undefined): void {
  ctx.pendingCompaction = undefined;
  ctx.active = operation;
  operation.pending = 1;
  if (ctx.closing) operation.userCancelled = true;
  else setState(ctx, "running");
  emit(ctx, "request_accepted", { requestId, operationId: operation.id, details: { kind: "compact" } });
  const invoke = async () => {
    if (!operation.userCancelled && !operation.cancelled) await ctx.session.compact(instructions);
  };
  let invocation: Promise<unknown>;
  try { invocation = ctx.options.extensionHandlers ? ctx.options.extensionHandlers.run(invoke) : invoke(); }
  catch (error) { invocation = Promise.reject(error); }
  void invocation.catch((error: unknown) => {
    if (error instanceof Error && error.message === "Compaction cancelled") operation.userCancelled = true;
    else operation.error = describeError(error, ctx.sessionOptions);
  }).finally(() => {
    operation.pending = 0;
    void settle(ctx, operation);
  });
}
