import { requireSource } from "../binding/require-active-source.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function flushPeerInbox(ctx: HostBindingContext): Promise<void> {
  return requireSource(ctx).flushPeerInbox();
}
