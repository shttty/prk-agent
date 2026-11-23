import type { HostContext, SubmitMessageRequest, Submission } from "../host-types.ts";
import { nonEmpty } from "./non-empty.ts";
import { reject } from "./reject-request.ts";
import { admit } from "./admit-input.ts";

export function submit(ctx: HostContext, request: SubmitMessageRequest): Promise<Submission> {
  if (!request || !nonEmpty(request.requestId) || (typeof request.message !== "string" || (!request.message.trim() && !request.images?.length))) return Promise.resolve(reject(ctx, request?.requestId ?? "", "Input requires a requestId and text or images."));
  if (request.queue !== undefined && request.queue !== "steer" && request.queue !== "followUp") return Promise.resolve(reject(ctx, request.requestId, "Invalid queue mode."));
  if (request.internalNotification !== undefined && (request.images !== undefined || request.queue === "steer")) return Promise.resolve(reject(ctx, request.requestId, "Internal notifications use followUp without images."));
  if (ctx.closing) return Promise.resolve(reject(ctx, request.requestId, "Session host is closed."));
  if (ctx.active?.requestIds.has(request.requestId) || ctx.recent.some((item) => item.requestIds.includes(request.requestId))) return Promise.resolve(reject(ctx, request.requestId, "requestId was already submitted; do not replay."));
  const admission = admit(ctx, request);
  if (!admission.accepted) return Promise.resolve(admission);
  const { invocation: _, ...submission } = admission;
  return Promise.resolve(submission);
}
