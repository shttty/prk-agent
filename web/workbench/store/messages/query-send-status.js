import { postJson } from "../requests/post-json.js";
export function querySendStatus(ctx, sessionId, requestId, streamId) {
  return postJson(ctx, `${ctx.apiRoot}/sessions/${encodeURIComponent(sessionId)}/send-status`, { requestId, streamId });
}
