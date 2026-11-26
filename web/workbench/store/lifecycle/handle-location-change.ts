import type { StoreContext } from "../store-context-types.ts";
import { viewQuery } from "../selection/view-query.ts";
import { selectSession } from "../selection/select-session.ts";

export function handleLocationChange(ctx: StoreContext) {
  const query = viewQuery();
  if (query && ctx.state.sessions.has(query.sessionId)) void selectSession(ctx, query.sessionId);
}
