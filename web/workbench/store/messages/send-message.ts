import type { StoreContext } from "../store-context-types.ts";
import type { SendOptions, SendQueue } from "./message-types.ts";
import { hostState } from "../selection/host-state.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { reconnect } from "../session-stream/reconnect.ts";
import { admitMessage } from "./admit-message.ts";
import { closeEventSource } from "../session-stream/close-event-source.ts";
import { selectSession } from "../selection/select-session.ts";
import { setError } from "../notices/set-error.ts";

/** Send `text` to the selected session; the second argument is the queue mode or the whole option set. */
export async function sendMessage(ctx: StoreContext, text: string, queueOrOptions: SendQueue | SendOptions = ctx.state.queue, options: SendOptions = {}): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  if (ctx.state.session.pending.has("sending") || ctx.disposed || !name) return false;
  const token = ctx.selectionToken;
  const draft = ctx.draftRevision;
  const captured = typeof queueOrOptions === "string" ? options : queueOrOptions;
  const sendOptions = { ...captured, attachments: captured.attachments || ctx.state.attachments, references: captured.references || ctx.state.references };
  if (!text.trim() && !sendOptions.attachments.length) return false;
  const queue = typeof queueOrOptions === "string" ? queueOrOptions : captured.queue || ctx.state.queue;
  const matches = () => !ctx.disposed && token === ctx.selectionToken && ctx.state.selectedSessionId === name;
  // No runtime (closed sessionRow, or an unavailable session), or a sessionRow whose kernel can no longer execute: the
  // Gateway starts a new runtime for this message. Post it directly, then attach a fresh stream to the new runtime.
  const dormant = ["closed", "unavailable"].includes(hostState(ctx));
  const restarts = dormant || ["failed", "unavailable"].includes(ctx.state.session.snapshot?.kernel?.state ?? "");
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
