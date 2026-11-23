import type { ClientContext } from "../client-state.ts";
import type { CollectionEventListener } from "../client-types.ts";

export function subscribeCollectionEvents(ctx: ClientContext, listener: CollectionEventListener) {
  ctx.collectionListeners.add(listener); return () => { ctx.collectionListeners.delete(listener); };
}
