import type { HostContext } from "../host/host-state.ts";
import type { HostedExtensionUI } from "../../sessions/extension-ui/ui-types.ts";

export function reconcileAsk(ctx: HostContext): void {
    if (ctx.asking.askQueued || ctx.lifecycle.closing) return;
    ctx.asking.askQueued = true;
    queueMicrotask(() => {
      ctx.asking.askQueued = false;
      if (ctx.lifecycle.closing) return;
      const live = new Map(ctx.host.history.listAll().flatMap((entry): [string, HostedExtensionUI][] => {
        const runtime = entry.sleeping ? undefined : ctx.host.collection.get(entry.sessionId);
        return runtime ? [[entry.sessionId, runtime.extensionUi]] : [];
      }));
      for (const [sessionId, watch] of ctx.asking.askWatches) {
        if (live.get(sessionId) === watch.ui) continue;
        watch.unsubscribe();
        ctx.asking.askWatches.delete(sessionId);
        if (watch.asking) ctx.methods.announceAsk(sessionId, false);
      }
      for (const [sessionId, ui] of live) {
        if (ctx.asking.askWatches.has(sessionId)) continue;
        ctx.asking.askWatches.set(sessionId, { ui, asking: false, unsubscribe: ui.subscribe(() => ctx.methods.syncAsk(sessionId)) });
        ctx.methods.syncAsk(sessionId);
      }
    });
  }
