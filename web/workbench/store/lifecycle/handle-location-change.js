import { viewQuery } from "../selection/view-query.js";
import { selectSession } from "../selection/select-session.js";
export function handleLocationChange(ctx) {
    const query = viewQuery(ctx);
    if (query && ctx.state.sessions.has(query.sessionId)) void selectSession(ctx, query.sessionId);
  }
