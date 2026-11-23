import type { HostContext } from "../host-types.ts";
import { lifecycle } from "./track-lifecycle.ts";
import { emit } from "../subscriptions/publish-event.ts";

export function reload(ctx: HostContext): Promise<void> {
  const kernel = ctx.kernel?.getSnapshot();
  if (ctx.closing || ctx.active || !ctx.session.isIdle || ctx.session.isCompacting || ctx.session.pendingMessageCount > 0
    || ctx.reloading || ctx.kernel?.hasInFlightCell?.() || kernel?.state === "busy" || kernel?.state === "starting") {
    return Promise.reject(new Error("Reload requires an idle host and kernel."));
  }
  return lifecycle(ctx, async () => {
    ctx.reloading = true;
    ctx.options.extensionHandlers?.cancel();
    emit(ctx, "reload_started");
    ctx.options.extensionUi?.reset();
    // The SDK keeps the session usable after a failed reload (native TUI reports the error and continues).
    try {
      await ctx.kernel?.prepareHandoff?.();
      await ctx.session.reload();
      emit(ctx, "reload_completed");
    } finally {
      if (!ctx.closing) ctx.kernel?.resumeAfterHandoff?.();
      ctx.reloading = false;
    }
  });
}
