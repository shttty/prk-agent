import type { HostContext } from "../host/host-state.ts";

export function syncAsk(ctx: HostContext, sessionId: string): void {
    const watch = ctx.asking.askWatches.get(sessionId);
    if (!watch || watch.asking === watch.ui.asking()) return;
    watch.asking = !watch.asking;
    ctx.methods.announceAsk(sessionId, watch.asking);
  }
