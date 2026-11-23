import type { SessionHostEvent } from "../../../sessions/host/host-types.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function emit(ctx: HostBindingContext, event: SessionHostEvent): void {
  for (const listener of [...ctx.subscribers]) {
    try { void Promise.resolve(listener(event)).catch(() => { }); }
    catch { /* An observer cannot change session lifecycle. */ }
  }
}
