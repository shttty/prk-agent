import type { StoreContext } from "../store-context-types.ts";
import type { SendStatus } from "./message-types.ts";
import { setNotice } from "../notices/set-notice.ts";
import { querySendStatus } from "./query-send-status.ts";
import { settleUnknownSend } from "./settle-unknown-send.ts";
import { sendMessage } from "./send-message.ts";

/**
 * Resend only what the Gateway confirms never ran: the status query withdraws the old requestId first, so the text goes
 * out once under a new one. A send it already took is just confirmed.
 */
export async function resendUnknownSends(ctx: StoreContext) {
  const sessionId = ctx.state.selectedSessionId;
  if (!sessionId) return;
  for (const [requestId, entry] of [...ctx.state.session.localMessages]) {
    if (entry.status !== "unknown" || entry.unconfirmable) continue;
    let status: SendStatus | null;
    try { status = await querySendStatus(ctx, sessionId, requestId, entry.streamId); }
    catch { setNotice(ctx, "连接未恢复，稍后再试。", "warning"); return; }
    if (ctx.state.selectedSessionId !== sessionId) return;
    settleUnknownSend(ctx, requestId, status);
    if (status === "refused") await sendMessage(ctx, entry.text);
  }
}
