import type { HostContext } from "../host-types.ts";
import type { CancelRequest, CancelResult } from "./cancel-types.ts";
import { requestCancel } from "./request-cancel.ts";

export async function cancel(ctx: HostContext, request: CancelRequest): Promise<CancelResult> {
  const operation = ctx.active;
  if (!operation || operation.id !== request.operationId) return {
    operationId: request.operationId,
    status: ctx.recent.some((item) => item.operationId === request.operationId) ? "already_complete" : "not_found",
    returnedMessages: [],
  };
  // Mark the matching operation before interrupt can synchronously publish. No cell means operation-only.
  operation.userCancelled = true;
  if (request.cell) ctx.kernel?.interruptCell?.(request.cell.kernelId, request.cell.cellId, "user");
  if (ctx.active === operation && !ctx.closing && !ctx.closed) requestCancel(ctx, operation);
  return { operationId: operation.id, status: "requested", returnedMessages: [...operation.returnedMessages], completion: operation.completion.promise };
}
