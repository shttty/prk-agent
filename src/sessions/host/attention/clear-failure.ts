import type { HostContext } from "../host-types.ts";
import { emit } from "../subscriptions/publish-event.ts";

export function clearFailure(ctx: HostContext): void {
  if (!ctx.retryGrace && !ctx.stopped) return;
  clearTimeout(ctx.retryGrace);
  ctx.retryGrace = undefined;
  ctx.stopped = undefined;
  emit(ctx, "state_changed", { details: { attentionChanged: true } });
}
