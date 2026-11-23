import type { HostContext, HostOperationSnapshot } from "../host-types.ts";

export function snapshotOperation(ctx: HostContext): HostOperationSnapshot | undefined {
  return ctx.active ? {
    operationId: ctx.active.id,
    startedAt: ctx.active.startedAt,
    state: ctx.active.cancelled ? "cancel_requested" : "running",
    requestIds: [...ctx.active.requestIds],
  } : undefined;
}
