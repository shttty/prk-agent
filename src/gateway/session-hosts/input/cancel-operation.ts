import type { CancelRequest, CancelResult } from "../../../sessions/host/operations/cancel-types.ts";
import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function cancel(ctx: HostBindingContext, request: CancelRequest): Promise<CancelResult> {
  return ctx.parent.methods.runtimeChange(() => requireSource(ctx).cancel(request));
}
