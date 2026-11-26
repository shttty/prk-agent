import { setNotice } from "../notices/set-notice.js";
import { querySendStatus } from "./query-send-status.js";
import { settleUnknownSend } from "./settle-unknown-send.js";
import { sendMessage } from "./send-message.js";
/**
 * Resend only what the Gateway confirms never ran: the status query withdraws the old requestId first, so the text goes
 * out once under a new one. A send it already took is just confirmed.
 */
export async function resendUnknownSends(ctx) {
  const sessionId = ctx.state.selectedSessionId;
  for (const [requestId, entry] of [...ctx.state.session.localMessages]) {
    if (entry?.status !== "unknown" || entry.unconfirmable) continue;
    let result;
    try { result = await querySendStatus(ctx, sessionId, requestId, entry.streamId); }
    catch { setNotice(ctx, "连接未恢复，稍后再试。", "warning"); return; }
    if (ctx.state.selectedSessionId !== sessionId) return;
    settleUnknownSend(ctx, requestId, result);
    if (result?.status === "refused") await sendMessage(ctx, entry.text);
  }
}
