import type { TargetEvent } from "../../../target-channel/channels/channel-types.ts";
import type { LoadContext } from "../load-types.ts";

export function publishHostEvent(ctx: LoadContext, event: TargetEvent): void {
  ctx.input.onRemoteExtensionEvent?.({ ...event, instance: ctx.input.target.id, package: "session", ...(ctx.input.sessionId === undefined ? {} : { sessionId: ctx.input.sessionId }) });
}
