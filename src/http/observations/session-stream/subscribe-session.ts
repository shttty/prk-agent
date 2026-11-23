import type { StreamContext } from "../observation-state.ts";
import { publishSessionSnapshot } from "./publish-session-snapshot.ts";
import { publishSessionEvent } from "./publish-session-event.ts";
import { endSessionStream } from "./end-session-stream.ts";

export async function subscribeSession(ctx: StreamContext): Promise<void> {
ctx.unsubscribe = await ctx.gateway.observe(ctx.sessionId!, {
  snapshot: (value) => publishSessionSnapshot(ctx, value),
  event: (value) => publishSessionEvent(ctx, value),
  end: () => endSessionStream(ctx),
});
}
