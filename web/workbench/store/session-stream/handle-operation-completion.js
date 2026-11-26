import { isRecord } from "../../payloads/is-record.js";
import { safeText } from "../../payloads/safe-text.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { MAX_RECENT_OPERATIONS } from "../store-constants.js";
import { patch } from "../updates/patch.js";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.js";
import { addActivity } from "../notices/add-activity.js";
import { completionLabel } from "../../payloads/completion-label.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { settleUnknownSend } from "../messages/settle-unknown-send.js";
export function handleOperationCompletion(ctx, details, event) {
    const completion = isRecord(details) ? details : {};
    const operationId = safeText(completion.operationId) || safeText(event?.operationId);
    if (!operationId) return;
    const status = safeText(completion.status) || "unknown";
    const operations = mergeEntry(ctx, ctx.state.session.operations, operationId, { accepted: true, completion });
    // Completion is authoritative even when its result is unknown; retire transport-only send feedback.
    const localMessages = new Map([...ctx.state.session.localMessages].filter(([, entry]) => entry?.operationId !== operationId));
    let snapshot = ctx.state.session.snapshot;
    let sessions = ctx.state.sessions;
    if (snapshot) {
      const recentOperations = [...(snapshot.recentOperations || []).filter((item) => item.operationId !== operationId), { ...completion, operationId }].slice(-MAX_RECENT_OPERATIONS);
      snapshot = { ...snapshot, recentOperations };
      // A terminal frame can retire its own operation even if the state_changed frame was missed.
      if (snapshot.operation?.operationId === operationId) {
        snapshot = { ...snapshot, state: "idle", operation: undefined };
        if (ctx.state.selectedSessionId) sessions = mergeEntry(ctx, sessions, ctx.state.selectedSessionId, { state: "idle", compacting: false, sessionId: ctx.state.selectedSessionId });
      }
    }
    const banner = ctx.state.session.banner?.operationId === operationId ? null : ctx.state.session.banner;
    patch(ctx, { sessions, session: { ...ctx.state.session, operations, localMessages, snapshot, banner, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
    restoreReturnedMessages(ctx, operationId, completion.returnedMessages, event?.sessionId || snapshot?.sessionId);
    for (const requestIdValue of Array.isArray(completion.requestIds) ? completion.requestIds : []) settleUnknownSend(ctx, requestIdValue, { status: "accepted" });
    addActivity(ctx, {
      title: `操作终态 · ${completionLabel(status)}`,
      time: event?.timestamp,
      meta: `${operationId}${completion.error ? ` · ${completion.error}` : ""}`,
      tone: status === "unknown" || status === "failed" ? "error" : status === "completed" ? "" : "notice",
    });
    persistCurrentSession(ctx);
  }

