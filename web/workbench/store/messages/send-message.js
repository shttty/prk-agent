import { isRecord } from "../../payloads/is-record.js";
import { hostState } from "../selection/host-state.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { reconnect } from "../session-stream/reconnect.js";
import { admitMessage } from "./admit-message.js";
import { closeEventSource } from "../session-stream/close-event-source.js";
import { selectSession } from "../selection/select-session.js";
import { setError } from "../notices/set-error.js";
export async function sendMessage(ctx, text, queueOrOptions = ctx.state.queue, options = {}) {
    if (ctx.state.session.pending.has("sending") || ctx.disposed || typeof text !== "string" || !ctx.state.selectedSessionId) return false;
    const name = ctx.state.selectedSessionId;
    const token = ctx.selectionToken;
    const draft = ctx.draftRevision;
    const captured = isRecord(queueOrOptions) ? queueOrOptions : options;
    const sendOptions = { ...captured, attachments: captured.attachments || ctx.state.attachments, references: captured.references || ctx.state.references };
    if (!text.trim() && !sendOptions.attachments.length) return false;
    const queue = typeof queueOrOptions === "string" ? queueOrOptions : captured.queue || ctx.state.queue;
    const matches = () => !ctx.disposed && token === ctx.selectionToken && ctx.state.selectedSessionId === name;
    // No runtime (closed sessionRow, or an unavailable session), or a sessionRow whose kernel can no longer execute: the
    // Gateway starts a new runtime for this message. Post it directly, then attach a fresh stream to the new runtime.
    const dormant = ["closed", "unavailable"].includes(hostState(ctx));
    const restarts = dormant || ["failed", "unavailable"].includes(ctx.state.session.snapshot?.kernel?.state);
    patchSession(ctx, { restoredDraft: null, pending: withPending(ctx.state.session.pending, "sending", true) });
    try {
      if (!dormant && ctx.state.session.connection !== "connected") {
        // Without a live stream there is no current base to send against: reopen an ended stream, keep the draft.
        void reconnect(ctx);
        setError(ctx, "连接未恢复，消息未发送。");
        return false;
      }
      if (!matches()) return false;
      const admitted = await admitMessage(ctx, text, queue, sendOptions, matches, draft);
      if (admitted && restarts && matches()) {
        closeEventSource(ctx);
        void selectSession(ctx, name);
      }
      return admitted;
    } finally {
      if (matches()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "sending", false) });
    }
  }

