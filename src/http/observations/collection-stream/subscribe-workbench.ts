import type { StreamContext } from "../observation-state.ts";
import { publishCollectionSnapshot } from "./publish-collection-snapshot.ts";
import { publishCollectionEvent } from "./publish-collection-event.ts";
import { endCollectionStream } from "./end-collection-stream.ts";

export async function subscribeWorkbench(ctx: StreamContext): Promise<void> {
ctx.unsubscribe = await ctx.gateway.observeSessions({
  snapshot: (value) => publishCollectionSnapshot(ctx, value),
  event: (value) => publishCollectionEvent(ctx, value),
  end: () => endCollectionStream(ctx),
});
}
