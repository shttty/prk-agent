import type { HostContext, RejectedSubmission } from "../host-types.ts";
import { emit } from "../subscriptions/publish-event.ts";

export function reject(ctx: HostContext, requestId: string, error: string): RejectedSubmission {
  emit(ctx, "request_rejected", { requestId, details: { error } });
  return { accepted: false, requestId, error };
}
