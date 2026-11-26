import type { StoreContext } from "../store-context-types.ts";
import type { SelectedSessionState } from "../store-types.ts";
import { normalizeSnapshot } from "../../payloads/normalize-snapshot.ts";
import { persistCurrentSession } from "../drafts/persist-current-session.ts";
import { replaceSession } from "../updates/replace-session.ts";
import { patchSession } from "../updates/patch-session.ts";
import { patch } from "../updates/patch.ts";
import { reconcileHistoryToolRuns } from "./reconcile-history-tool-runs.ts";
import { mergeLoadedHistory } from "./merge-loaded-history.ts";
import { mergeEntry } from "../updates/merge-entry.ts";
import { nativeFeedbackForSession } from "../native-actions/native-feedback-for-session.ts";
import { extensionUiRevision } from "../extension-ui/extension-ui-revision.ts";
import { restoreReturnedMessages } from "../drafts/restore-returned-messages.ts";
import { restoredOperations } from "../drafts/restored-operations.ts";
import { loadNativeCatalog } from "../native-actions/load-native-catalog.ts";
import { flushScroll } from "../drafts/flush-scroll.ts";
import { savedUnknownSends } from "../messages/saved-unknown-sends.ts";
import { settleUnknownSend } from "../messages/settle-unknown-send.ts";
import { confirmUnknownSends } from "../messages/confirm-unknown-sends.ts";
import { rowStateOf } from "./row-state-of.ts";

/** Take a session snapshot as the page's base (a new stream starts the session state over). Throws on a malformed snapshot; false when it is older than the one held. */
export function ingestSnapshot(ctx: StoreContext, value: unknown, observation = false): boolean {
  let snapshot = normalizeSnapshot(value);
  if (!snapshot) throw new Error("服务返回的会话快照格式无效。");
  const previous = ctx.state.session.snapshot;
  const changedStream = snapshot.streamId !== ctx.state.session.streamId;
  if (!changedStream && snapshot.sequence < ctx.state.session.lastSequence) return false;
  if (!observation) {
    ctx.historyRefresh = undefined;
    if (!changedStream) snapshot = mergeLoadedHistory(previous, snapshot);
  }
  if (changedStream) startStream(ctx, snapshot.streamId);
  let operations = ctx.state.session.operations;
  const toolRuns = reconcileHistoryToolRuns(snapshot, ctx.state.session.toolRuns, ctx.state.selectedSessionId);
  let banner = ctx.state.session.banner;
  let localMessages = ctx.state.session.localMessages;
  const transcriptRevision = ctx.state.session.transcriptRevision + (changedStream || (previous && snapshot.sequence > previous.sequence) ? 1 : 0);
  const streams = observation && !changedStream && snapshot.operation ? ctx.state.session.streams : new Map();
  const completedOperationIds = new Set<string>();
  // An unknown send this snapshot lists was taken by the Gateway; settle it after the snapshot lands.
  const delivered: string[] = [];
  for (const completion of snapshot.recentOperations) {
    if (!completion.operationId) continue;
    delivered.push(...completion.requestIds);
    operations = mergeEntry(operations, completion.operationId, { accepted: true, completion });
    if (completion.status === "completed") completedOperationIds.add(completion.operationId);
  }
  if (snapshot.operation?.operationId) {
    const id = snapshot.operation.operationId;
    operations = mergeEntry(operations, id, { accepted: true });
    for (const requestIdValue of snapshot.operation.requestIds) {
      if (localMessages.get(requestIdValue)?.status === "unknown") delivered.push(requestIdValue);
      else if (localMessages.has(requestIdValue)) localMessages = mergeEntry(localMessages, requestIdValue, { status: "accepted", operationId: id });
    }
  }
  if (completedOperationIds.size) {
    localMessages = new Map([...localMessages].filter(([, entry]) => !(entry.operationId && completedOperationIds.has(entry.operationId))));
  }
  const cancelPending = banner?.kind === "cancel-pending" ? banner.operationId : undefined;
  if (cancelPending && snapshot.recentOperations.some((completion) => completion.operationId === cancelPending)) banner = null;
  const nativeFeedback = nativeFeedbackForSession(ctx, ctx.state.session.nativeFeedback).slice(-128);
  const sessionState = rowStateOf(snapshot.state);
  const selected = ctx.state.selectedSessionId;
  const routeSessionRow = selected ? ctx.state.sessions.get(selected) : undefined;
  const sessions = selected && routeSessionRow
    ? new Map(ctx.state.sessions).set(selected, { ...routeSessionRow, sessionId: selected, state: sessionState, compacting: sessionState === "running" && snapshot.operation?.kind === "compact" })
    : ctx.state.sessions;
  const historyPage = !changedStream && snapshot.historyBefore === previous?.historyBefore ? ctx.state.session.historyPage : { loading: false, error: "" };
  patch(ctx, { sessions, session: { ...ctx.state.session, snapshot, lastSequence: snapshot.sequence, streams, operations, toolRuns, localMessages, nativeFeedback, banner, transcriptRevision, historyPage, ...extensionUiOf(ctx, snapshot.extensionUi) } });
  for (const completion of snapshot.recentOperations) {
    restoreReturnedMessages(ctx, completion.operationId, completion.returnedMessages, ctx.state.selectedSessionId);
  }
  for (const requestIdValue of delivered) settleUnknownSend(ctx, requestIdValue, "accepted");
  confirmUnknownSends(ctx);
  if (changedStream && ctx.source) void loadNativeCatalog(ctx);
  return true;
}

/** The selected session's stream changed (first snapshot, sleep and wake, Gateway restart): start its state over, keeping what outlives a stream. */
function startStream(ctx: StoreContext, streamId: string) {
  const name = ctx.state.selectedSessionId;
  const wakeWaitingForSnapshot = name ? ctx.wakeRequests.get(name) : undefined;
  if (name && wakeWaitingForSnapshot && wakeWaitingForSnapshot !== streamId) ctx.wakeRequests.delete(name);
  flushScroll(ctx);
  persistCurrentSession(ctx);
  const connection = ctx.source ? "connected" : ctx.state.session.connection;
  // The selected draft's HTTP send can outlive the sleeping stream it started on.
  const sending = ctx.state.session.pending.has("sending");
  const undelivered = ctx.state.session.restoredDraft?.reason === "undelivered" ? ctx.state.session.restoredDraft : null;
  replaceSession(ctx, streamId, sending ? { pending: new Set(["sending"]) } : null);
  const saved = ctx.state.selectedSessionId ? ctx.storage.sessionState(ctx.state.selectedSessionId) : null;
  // Unknown sends outlive the stream they went out on (sleep, wake, Gateway restart).
  patchSession(ctx, { connection, localMessages: savedUnknownSends(saved), restoredDraft: undelivered, operations: restoredOperations(saved?.restoredQueueCounts ?? []) });
}

/** A full snapshot without a UI host also retires that host's render and revision; a held newer revision is kept. */
function extensionUiOf(ctx: StoreContext, incoming: SelectedSessionState["extensionUi"] | undefined): Partial<SelectedSessionState> {
  if (!incoming) return { extensionUi: null, extensionUiRender: null };
  const held = extensionUiRevision(ctx.state.session.extensionUi);
  return held === null || (extensionUiRevision(incoming) ?? -1) >= held ? { extensionUi: incoming } : {};
}
