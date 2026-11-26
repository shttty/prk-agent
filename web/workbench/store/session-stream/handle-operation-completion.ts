import type { OperationCompletion, SessionHostEvent } from "../../../../src/gateway/wire/web-types.ts";
import type { StoreContext } from "../store-context-types.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { MAX_RECENT_OPERATIONS } from "../store-constants.ts";
import { patch } from "../updates/patch.ts";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.ts";
import { addActivity } from "../notices/add-activity.ts";
import { completionLabel } from "../../payloads/completion-label.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { settleUnknownSend } from "../messages/settle-unknown-send.ts";

const STATUSES = ["completed", "failed", "cancelled", "unknown"] as const;

export function handleOperationCompletion(ctx: StoreContext, details: unknown, event: SessionHostEvent) {
  const raw = isRecord(details) ? details : {};
  const operationId = safeText(raw.operationId) || safeText(event.operationId);
  if (!operationId) return;
  const completion: OperationCompletion = {
    ...raw,
    operationId,
    status: STATUSES.find((status) => status === raw.status) ?? "unknown",
    requestIds: Array.isArray(raw.requestIds) ? raw.requestIds.filter((id): id is string => typeof id === "string") : [],
  };
  const operations = mergeEntry(ctx.state.session.operations, operationId, { accepted: true, completion });
  // Completion is authoritative even when its result is unknown; retire transport-only send feedback.
  const localMessages = new Map([...ctx.state.session.localMessages].filter(([, entry]) => entry.operationId !== operationId));
  let snapshot = ctx.state.session.snapshot;
  let sessions = ctx.state.sessions;
  if (snapshot) {
    const recentOperations = [...(snapshot.recentOperations || []).filter((item) => item.operationId !== operationId), completion].slice(-MAX_RECENT_OPERATIONS);
    snapshot = { ...snapshot, recentOperations };
    // A terminal frame can retire its own operation even if the state_changed frame was missed.
    if (snapshot.operation?.operationId === operationId) {
      snapshot = { ...snapshot, state: "idle", operation: undefined };
      if (ctx.state.selectedSessionId) sessions = mergeEntry(sessions, ctx.state.selectedSessionId, { state: "idle", compacting: false, sessionId: ctx.state.selectedSessionId });
    }
  }
  const banner = ctx.state.session.banner?.operationId === operationId ? null : ctx.state.session.banner;
  patch(ctx, { sessions, session: { ...ctx.state.session, operations, localMessages, snapshot, banner, transcriptRevision: ctx.state.session.transcriptRevision + 1 } });
  restoreReturnedMessages(ctx, operationId, raw.returnedMessages, event.sessionId || snapshot?.sessionId);
  for (const requestIdValue of completion.requestIds) settleUnknownSend(ctx, requestIdValue, "accepted");
  addActivity(ctx, {
    title: `操作终态 · ${completionLabel(completion.status)}`,
    time: event.timestamp,
    meta: `${operationId}${completion.error ? ` · ${completion.error}` : ""}`,
    tone: completion.status === "unknown" || completion.status === "failed" ? "error" : completion.status === "completed" ? "" : "notice",
  });
  persistCurrentSession(ctx);
}
