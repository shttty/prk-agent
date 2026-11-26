import { querySendStatus } from "./query-send-status.js";
import { settleUnknownSend } from "./settle-unknown-send.js";
/**
 * Ask the Gateway what became of each send whose reply was lost (REQ-7). It answers from its record of the
 * requestId; one it never saw is withdrawn there, so "refused" is final. A failed query keeps the send unknown until
 * the next snapshot asks again.
 */
export function confirmUnknownSends(ctx) {
  const sessionId = ctx.state.selectedSessionId;
  for (const [requestId, entry] of ctx.state.session.localMessages) {
    if (entry?.status !== "unknown" || entry.unconfirmable || ctx.sendChecks.has(requestId)) continue;
    ctx.sendChecks.add(requestId);
    void querySendStatus(ctx, sessionId, requestId, entry.streamId)
      .then((result) => { if (ctx.state.selectedSessionId === sessionId) settleUnknownSend(ctx, requestId, result); }, () => {})
      .finally(() => ctx.sendChecks.delete(requestId));
  }
}
