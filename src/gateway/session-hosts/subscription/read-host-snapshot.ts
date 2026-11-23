import type { SessionHostSnapshot } from "../../../sessions/host/host-types.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function snapshot(ctx: HostBindingContext, includeHistory = true): SessionHostSnapshot {
  return ctx.source
    ? ctx.parent.methods.decorateSnapshot(ctx.sessionId, ctx.source.getSnapshot(false), includeHistory)
    : ctx.parent.methods.archivedSnapshot(ctx.parent.methods.storedSession(ctx.sessionId), includeHistory);
}
