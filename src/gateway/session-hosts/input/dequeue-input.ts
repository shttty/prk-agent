import type { DequeueResult } from "../../../sessions/host/host-types.ts";
import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function dequeue(ctx: HostBindingContext): DequeueResult {
  return requireSource(ctx).dequeue();
}
