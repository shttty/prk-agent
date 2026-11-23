import { WireError } from "../../wire/create-error.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export async function reload(ctx: HostBindingContext): Promise<void> {
  if (ctx.parent.lifecycle.transitions.has(ctx.sessionId)) throw new WireError("BUSY", "Session is changing; reload was not submitted.");
  return ctx.parent.methods.changeSessionRuntime(ctx.sessionId, async () => {
    const current = ctx.parent.methods.storedSession(ctx.sessionId);
    const runtime = current.sleeping ? undefined : ctx.parent.host.collection.get(ctx.sessionId);
    const host = runtime?.host.getSnapshot();
    if (!runtime || host?.state === "closed") throw new WireError("UNAVAILABLE", "Reload requires an active runtime; it never wakes or creates one.");
    const kernel = runtime.kernel.getSnapshot();
    if (host?.state !== "idle" || runtime.host.isIdle === false
      || !runtime.session.isIdle || runtime.session.isCompacting || runtime.session.pendingMessageCount > 0
      || runtime.kernel.hasInFlightCell?.() || kernel.state === "busy" || kernel.state === "starting") {
      throw new WireError("BUSY", "Session must be idle to reload tools and skills.");
    }
    (0, ctx.unsubscribe)?.();
    ctx.unsubscribe = undefined;
    try { await ctx.parent.host.collection.reload(ctx.sessionId); }
    finally {
      ctx.original = undefined;
      ctx.parent.methods.publishCapabilities(ctx.sessionId);
    }
  });
}
