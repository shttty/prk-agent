import { dispatch } from "./dispatch.ts";
import { invoke } from "./invoke.ts";
import type { HostContext, SubmitMessageRequest, RejectedSubmission, AcceptedSubmission, Operation } from "../host-types.ts";
import { randomUUID } from "node:crypto";
import type { PromptOptions } from "@earendil-works/pi-coding-agent";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { describeSessionFailure } from "../../../diagnostics/session-errors/describe-session-failure.ts";
import { reject } from "./reject-request.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { setState } from "../operations/set-host-state.ts";
import { settle } from "../operations/settle-operation.ts";

export function admit(ctx: HostContext, request: SubmitMessageRequest, peerPreflight?: PromptOptions["preflightResult"]): RejectedSubmission | (AcceptedSubmission & { invocation: Promise<unknown> }) {
  if (ctx.closing || ctx.reloading) return reject(ctx, request.requestId, "Host is closing or reloading.");
  if (ctx.active?.cancelled) return reject(ctx, request.requestId, "Cancellation is still settling.");
  if (ctx.session.isCompacting) return reject(ctx, request.requestId, "Session is busy with compaction or branch summarization; wait for idle.");
  if (ctx.active && !request.queue) return reject(ctx, request.requestId, "queue must be 'steer' or 'followUp' while an operation is active.");
  if (!ctx.active && !ctx.session.isIdle) return reject(ctx, request.requestId, "Session is busy; retry when the SDK reports idle.");
  const operation: Operation = ctx.active ?? {
    id: `${ctx.sessionId}:${randomUUID()}`,
    startedAt: Date.now(),
    messageCount: ctx.session.messages.length,
    requestIds: new Set(),
    completion: Promise.withResolvers(),
    pending: 0,
    cancelled: false,
    aborted: false,
    pythonStarted: false,
    unknown: false,
    returnedMessages: [],
  };
  const queued = ctx.active !== undefined;
  ctx.active = operation;
  operation.requestIds.add(request.requestId);
  operation.pending += 1;
  // Both queued and extension-handled input are successful SDK admissions, not
  // completed turns. settle() still waits for the SDK's authoritative idle state.
  let invocation: Promise<unknown>;
  try {
    const images = request.images === undefined || request.images.length === 0 ? undefined : [...request.images];
    const dispatchInput = (): Promise<unknown> => dispatch(ctx, operation, request, peerPreflight, queued, images);
    const invokeInput = (): Promise<unknown> => invoke(ctx, queued, dispatchInput);
    invocation = ctx.options.extensionHandlers ? ctx.options.extensionHandlers.run(invokeInput) : invokeInput();
  } catch (error) {
    invocation = Promise.reject(error);
  }
  // Acceptance records only this process's SDK invocation; later rejection settles completion as an error.
  emit(ctx, "request_accepted", { requestId: request.requestId, operationId: operation.id, details: { queue: request.queue ?? "initial" } });
  if (!operation.cancelled) setState(ctx, "running");
  void invocation.then(undefined, (error: unknown) => {
    operation.error = describeError(error, ctx.sessionOptions);
    const sessionDetail = describeSessionFailure(ctx.session, operation.error, operation.messageCount, ctx.sessionOptions);
    const logDetail = sessionDetail ? `${operation.error}\n\n${sessionDetail}` : operation.error;
    console.error(`[${new Date().toISOString()}] Gateway request ${request.requestId} failed after local acceptance; session ${ctx.sessionId}.\n${boundedError(logDetail, ctx.sessionOptions.errorDetailChars)}`);
  }).finally(() => {
    operation.pending -= 1;
    void settle(ctx, operation);
  });
  return { accepted: true, requestId: request.requestId, operationId: operation.id, sessionId: ctx.sessionId, completion: operation.completion.promise, invocation };
}
