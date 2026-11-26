import type { StoreContext } from "../store-context-types.ts";

/** A check, taken now, that the selection and stream a request started on are still the page's. */
export function sessionRequestCurrent(ctx: StoreContext): () => boolean {
  const token = ctx.selectionToken;
  const streamId = ctx.state.session.streamId;
  return () => !ctx.disposed && token === ctx.selectionToken && streamId === ctx.state.session.streamId;
}
