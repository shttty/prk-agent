import type { KernelInterruptRequest, KernelInterruptResult } from "../../../sessions/host/operations/cancel-types.ts";
import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function interruptCell(ctx: HostBindingContext, request: KernelInterruptRequest): Promise<KernelInterruptResult> {
  return ctx.parent.methods.runtimeChange(() => requireSource(ctx).interruptCell(request));
}
