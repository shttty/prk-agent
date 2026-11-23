import type { HostContext, HostState } from "../host-types.ts";
import { emit } from "../subscriptions/publish-event.ts";
import { snapshotOperation } from "../snapshots/format-operation.ts";

export function setState(ctx: HostContext, next: HostState): void {
  if (ctx.closing && next !== "closed") return;
  if (ctx.state === next) return;
  ctx.state = next;
  emit(ctx, "state_changed", { details: { state: ctx.state, operation: snapshotOperation(ctx) ?? null } });
}
