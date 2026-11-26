import { normalizeSnapshot } from "../../payloads/normalize-snapshot.js";
import { persistCurrentSession } from "../drafts/persist-current-session.js";
import { replaceSession } from "../updates/replace-session.js";
import { patchSession } from "../updates/patch-session.js";
import { patch } from "../updates/patch.js";
import { reconcileHistoryToolRuns } from "./reconcile-history-tool-runs.js";
import { mergeLoadedHistory } from "./merge-loaded-history.js";
import { mergeEntry } from "../updates/merge-entry.js";
import { nativeFeedbackForSession } from "../native-actions/native-feedback-for-session.js";
import { isRecord } from "../../payloads/is-record.js";
import { extensionUiRevision } from "../extension-ui/extension-ui-revision.js";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.js";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.js";
import { flushScroll } from "../drafts/flush-scroll.js";
import { savedUnknownSends } from "../messages/saved-unknown-sends.js";
import { settleUnknownSend } from "../messages/settle-unknown-send.js";
import { confirmUnknownSends } from "../messages/confirm-unknown-sends.js";
export function ingestSnapshot(ctx, value, observation = false) {
    let snapshot = normalizeSnapshot(value);
    if (!snapshot) throw new Error("服务返回的会话快照格式无效。");
    const previous = ctx.state.session.snapshot;
    const changedStream = snapshot.streamId !== ctx.state.session.streamId;
    if (!changedStream && snapshot.sequence < ctx.state.session.lastSequence) return false;
    if (!observation) {
      ctx.historyRefresh = undefined;
      if (!changedStream) snapshot = mergeLoadedHistory(previous, snapshot);
    }
    if (changedStream) {
      const name = ctx.state.selectedSessionId;
      const wakeWaitingForSnapshot = ctx.wakeRequests.get(name);
      if (wakeWaitingForSnapshot && wakeWaitingForSnapshot !== snapshot.streamId) ctx.wakeRequests.delete(name);
      flushScroll(ctx);
      persistCurrentSession(ctx);
      const connection = ctx.source ? "connected" : ctx.state.session.connection;
      // The selected draft's HTTP send can outlive the sleeping stream it started on.
      const sending = ctx.state.session.pending.has("sending");
      const undelivered = ctx.state.session.restoredDraft?.reason === "undelivered" ? ctx.state.session.restoredDraft : null;
      replaceSession(ctx, snapshot.streamId, sending ? { pending: new Set(["sending"]) } : null);
      const saved = ctx.storage.sessionState(ctx.state.selectedSessionId);
      // Unknown sends outlive the stream they went out on (sleep, wake, Gateway restart).
      patchSession(ctx, { connection, localMessages: savedUnknownSends(saved), restoredDraft: undelivered, operations: new Map((saved?.restoredQueueCounts || []).map(([operationId, restoredQueueCount]) => [operationId, { restoredQueueCount }])) });
    }
    let operations = ctx.state.session.operations;
    const toolRuns = reconcileHistoryToolRuns(snapshot, ctx.state.session.toolRuns, ctx.state.selectedSessionId);
    let banner = ctx.state.session.banner;
    let localMessages = ctx.state.session.localMessages;
    const transcriptRevision = ctx.state.session.transcriptRevision + (changedStream || snapshot.sequence > previous?.sequence ? 1 : 0);
    const streams = observation && !changedStream && snapshot.operation ? ctx.state.session.streams : new Map();
    const completedOperationIds = new Set();
    // An unknown send this snapshot lists was taken by the Gateway; settle it after the snapshot lands.
    const delivered = [];
    for (const completion of snapshot.recentOperations || []) {
      if (!completion.operationId) continue;
      delivered.push(...(completion.requestIds || []));
      operations = mergeEntry(ctx, operations, completion.operationId, { accepted: true, completion });
      if (completion.status === "completed") completedOperationIds.add(completion.operationId);
    }
    if (snapshot.operation?.operationId) {
      const id = snapshot.operation.operationId;
      operations = mergeEntry(ctx, operations, id, { accepted: true });
      for (const requestIdValue of snapshot.operation.requestIds || []) {
        if (localMessages.get(requestIdValue)?.status === "unknown") delivered.push(requestIdValue);
        else if (localMessages.has(requestIdValue)) localMessages = mergeEntry(ctx, localMessages, requestIdValue, { status: "accepted", operationId: id });
      }
    }
    if (completedOperationIds.size) {
      localMessages = new Map([...localMessages].filter(([, entry]) => !completedOperationIds.has(entry?.operationId)));
    }
    if (banner?.kind === "cancel-pending" && (snapshot.recentOperations || []).some((completion) => completion.operationId === banner.operationId)) banner = null;
    const nativeFeedback = nativeFeedbackForSession(ctx, ctx.state.session.nativeFeedback).slice(-128);
    const sessionState = snapshot.state === "cancel_requested" ? "running" : snapshot.state;
    const routeSessionRow = ctx.state.sessions.get(ctx.state.selectedSessionId);
    const sessions = ctx.state.selectedSessionId && routeSessionRow
      ? new Map(ctx.state.sessions).set(ctx.state.selectedSessionId, {
        ...routeSessionRow,
        sessionId: ctx.state.selectedSessionId,
        state: sessionState,
        compacting: sessionState === "running" && snapshot.operation?.kind === "compact",
      })
      : ctx.state.sessions;
    // A full snapshot without a UI host also retires that host's render and revision.
    const extensionUi = !isRecord(snapshot.extensionUi)
      ? { extensionUi: null, extensionUiRender: null }
      : extensionUiRevision(ctx, ctx.state.session.extensionUi) === null || (extensionUiRevision(ctx, snapshot.extensionUi) ?? -1) >= (extensionUiRevision(ctx, ctx.state.session.extensionUi) ?? -1)
        ? { extensionUi: snapshot.extensionUi } : {};
    const historyPage = !changedStream && snapshot.historyBefore === previous?.historyBefore ? ctx.state.session.historyPage : { loading: false, error: "" };
    patch(ctx, { sessions, session: { ...ctx.state.session, snapshot, lastSequence: snapshot.sequence, streams, operations, toolRuns, localMessages, nativeFeedback, banner, transcriptRevision, historyPage, ...extensionUi } });
    for (const completion of snapshot.recentOperations) {
      restoreReturnedMessages(ctx, completion.operationId, completion.returnedMessages, ctx.state.selectedSessionId);
    }
    for (const requestIdValue of delivered) settleUnknownSend(ctx, requestIdValue, { status: "accepted" });
    confirmUnknownSends(ctx);
    if (changedStream && ctx.source) void loadNativeCatalog(ctx);
    return true;
  }

