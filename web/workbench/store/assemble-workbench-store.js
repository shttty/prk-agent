import { initializeStoreContext } from "./initialize-store-context.js";
import { assembleNativeActions } from "./assemble-native-actions.js";
import { createWorkbenchActions } from "./create-workbench-actions.js";
import { notifyListeners } from "./updates/notify-listeners.js";
import { flushDisplayNotify } from "./updates/flush-display-notify.js";
import { queueDisplayNotify } from "./updates/queue-display-notify.js";
import { patch } from "./updates/patch.js";
import { patchSession } from "./updates/patch-session.js";
import { replaceSession } from "./updates/replace-session.js";
import { sessionRequestCurrent } from "./selection/session-request-current.js";
import { viewQuery } from "./selection/view-query.js";
import { replaceViewQuery } from "./selection/replace-view-query.js";
import { nativePath } from "./native-actions/native-path.js";
import { subscribe } from "./updates/subscribe.js";
import { setError } from "./notices/set-error.js";
import { setBanner } from "./notices/set-banner.js";
import { setNotice } from "./notices/set-notice.js";
import { clearError } from "./notices/clear-error.js";
import { clearNotice } from "./notices/clear-notice.js";
import { addActivity } from "./notices/add-activity.js";
import { mergeEntry } from "./updates/merge-entry.js";
import { updateSessionRow } from "./workbench-snapshot/update-session-row.js";
import { applyWorkbenchSnapshot } from "./workbench-snapshot/apply-workbench-snapshot.js";
import { requestJson } from "./requests/request-json.js";
import { getJson } from "./requests/get-json.js";
import { postJson } from "./requests/post-json.js";
import { sessionPhase } from "./requests/session-phase.js";
import { phaseChanged } from "./requests/phase-changed.js";
import { postSettled } from "./requests/post-settled.js";
import { loadReferenceCandidates } from "./references/load-reference-candidates.js";
import { clearReferenceCandidates } from "./references/clear-reference-candidates.js";
import { setAttachments } from "./drafts/set-attachments.js";
import { setReferences } from "./drafts/set-references.js";
import { persistCurrentSession } from "./drafts/persist-current-session.js";
import { restoreSession } from "./drafts/restore-session.js";
import { clearSessionState } from "./selection/clear-session-state.js";
import { restoreReturnedMessages } from "./drafts/restore-returned-messages.js";
import { hostState } from "./selection/host-state.js";
import { activeOperation } from "./selection/active-operation.js";
import { reconcileRequest } from "./session-stream/reconcile-request.js";
import { ingestSnapshot } from "./session-stream/ingest-snapshot.js";
import { loadHistoryPage } from "./session-stream/load-history-page.js";
import { handleOperationCompletion } from "./session-stream/handle-operation-completion.js";
import { handleStateChanged } from "./session-stream/handle-state-changed.js";
import { handleHostEvent } from "./session-stream/handle-host-event.js";
import { handleSsePayload } from "./session-stream/handle-sse-payload.js";
import { closeEventSource } from "./session-stream/close-event-source.js";
import { closeWorkbenchEventSource } from "./workbench-snapshot/close-workbench-event-source.js";
import { openWorkbenchEventSource } from "./workbench-snapshot/open-workbench-event-source.js";
import { openEventSource } from "./session-stream/open-event-source.js";
import { openHistory } from "./selection/open-history.js";
import { selectSession } from "./selection/select-session.js";
import { loadModelCatalog } from "./workbench-snapshot/load-model-catalog.js";
import { designateRole } from "./session-control/designate-role.js";
import { mutateWorkbench } from "./workbench-snapshot/mutate-workbench.js";
import { reloadTargets } from "./targets/reload-targets.js";
import { sendMessage } from "./messages/send-message.js";
import { admitMessage } from "./messages/admit-message.js";
import { cancelOperation } from "./messages/cancel-operation.js";
import { reconnect } from "./session-stream/reconnect.js";
import { createSession } from "./session-management/create-session.js";
import { renameSession } from "./session-management/rename-session.js";
import { assignProject } from "./session-management/assign-project.js";
import { manageSession } from "./session-management/manage-session.js";
import { archivePreview } from "./session-management/archive-preview.js";
import { archiveSession } from "./session-management/archive-session.js";
import { archiveProjectPreview } from "./session-management/archive-project-preview.js";
import { archiveProject } from "./session-management/archive-project.js";
import { unarchive } from "./session-management/unarchive.js";
import { purgeArchive } from "./session-management/purge-archive.js";
import { mutateArchive } from "./session-management/mutate-archive.js";
import { recoverSession } from "./session-management/recover-session.js";
import { getTarget } from "./targets/get-target.js";
import { inspectTarget } from "./targets/inspect-target.js";
import { browseTarget } from "./targets/browse-target.js";
import { saveTarget } from "./targets/save-target.js";
import { deleteTarget } from "./targets/delete-target.js";
import { deployEnvironment } from "./targets/deploy-environment.js";
import { setDraft } from "./drafts/set-draft.js";
import { setQueue } from "./drafts/set-queue.js";
import { setViewMode } from "./view-mode/set-view-mode.js";
import { savePresentation } from "./drafts/save-presentation.js";
import { noteScroll } from "./drafts/note-scroll.js";
import { flushScroll } from "./drafts/flush-scroll.js";
import { handleLocationChange } from "./lifecycle/handle-location-change.js";
import { handleConnectionResume } from "./lifecycle/handle-connection-resume.js";
import { start } from "./lifecycle/start.js";
import { dispose } from "./lifecycle/dispose.js";
import { API_ROOT } from "./store-constants.js";
export function createWorkbenchStore({ apiRoot = API_ROOT } = {}) {
  const ctx = { apiRoot };
  ctx.bound = {
    notifyListeners: (...args) => notifyListeners(ctx, ...args),
    flushDisplayNotify: (...args) => flushDisplayNotify(ctx, ...args),
    queueDisplayNotify: (...args) => queueDisplayNotify(ctx, ...args),
    patch: (...args) => patch(ctx, ...args),
    patchSession: (...args) => patchSession(ctx, ...args),
    replaceSession: (...args) => replaceSession(ctx, ...args),
    sessionRequestCurrent: (...args) => sessionRequestCurrent(ctx, ...args),
    viewQuery: (...args) => viewQuery(ctx, ...args),
    replaceViewQuery: (...args) => replaceViewQuery(ctx, ...args),
    nativePath: (...args) => nativePath(ctx, ...args),
    subscribe: (...args) => subscribe(ctx, ...args),
    setError: (...args) => setError(ctx, ...args),
    setBanner: (...args) => setBanner(ctx, ...args),
    setNotice: (...args) => setNotice(ctx, ...args),
    clearError: (...args) => clearError(ctx, ...args),
    clearNotice: (...args) => clearNotice(ctx, ...args),
    addActivity: (...args) => addActivity(ctx, ...args),
    mergeEntry: (...args) => mergeEntry(ctx, ...args),
    updateSessionRow: (...args) => updateSessionRow(ctx, ...args),
    applyWorkbenchSnapshot: (...args) => applyWorkbenchSnapshot(ctx, ...args),
    requestJson: (...args) => requestJson(ctx, ...args),
    getJson: (...args) => getJson(ctx, ...args),
    postJson: (...args) => postJson(ctx, ...args),
    sessionPhase: (...args) => sessionPhase(ctx, ...args),
    phaseChanged: (...args) => phaseChanged(ctx, ...args),
    postSettled: (...args) => postSettled(ctx, ...args),
    ...assembleNativeActions(ctx),
    loadReferenceCandidates: (...args) => loadReferenceCandidates(ctx, ...args),
    clearReferenceCandidates: (...args) => clearReferenceCandidates(ctx, ...args),
    setAttachments: (...args) => setAttachments(ctx, ...args),
    setReferences: (...args) => setReferences(ctx, ...args),
    persistCurrentSession: (...args) => persistCurrentSession(ctx, ...args),
    restoreSession: (...args) => restoreSession(ctx, ...args),
    clearSessionState: (...args) => clearSessionState(ctx, ...args),
    restoreReturnedMessages: (...args) => restoreReturnedMessages(ctx, ...args),
    hostState: (...args) => hostState(ctx, ...args),
    activeOperation: (...args) => activeOperation(ctx, ...args),
    reconcileRequest: (...args) => reconcileRequest(ctx, ...args),
    ingestSnapshot: (...args) => ingestSnapshot(ctx, ...args),
    loadHistoryPage: (...args) => loadHistoryPage(ctx, ...args),
    handleOperationCompletion: (...args) => handleOperationCompletion(ctx, ...args),
    handleStateChanged: (...args) => handleStateChanged(ctx, ...args),
    handleHostEvent: (...args) => handleHostEvent(ctx, ...args),
    handleSsePayload: (...args) => handleSsePayload(ctx, ...args),
    closeEventSource: (...args) => closeEventSource(ctx, ...args),
    closeWorkbenchEventSource: (...args) => closeWorkbenchEventSource(ctx, ...args),
    openWorkbenchEventSource: (...args) => openWorkbenchEventSource(ctx, ...args),
    openEventSource: (...args) => openEventSource(ctx, ...args),
    openHistory: (...args) => openHistory(ctx, ...args),
    selectSession: (...args) => selectSession(ctx, ...args),
    loadModelCatalog: (...args) => loadModelCatalog(ctx, ...args),
    designateRole: (...args) => designateRole(ctx, ...args),
    mutateWorkbench: (...args) => mutateWorkbench(ctx, ...args),
    reloadTargets: (...args) => reloadTargets(ctx, ...args),
    sendMessage: (...args) => sendMessage(ctx, ...args),
    admitMessage: (...args) => admitMessage(ctx, ...args),
    cancelOperation: (...args) => cancelOperation(ctx, ...args),
    reconnect: (...args) => reconnect(ctx, ...args),
    createSession: (...args) => createSession(ctx, ...args),
    renameSession: (...args) => renameSession(ctx, ...args),
    assignProject: (...args) => assignProject(ctx, ...args),
    manageSession: (...args) => manageSession(ctx, ...args),
    archivePreview: (...args) => archivePreview(ctx, ...args),
    archiveSession: (...args) => archiveSession(ctx, ...args),
    archiveProjectPreview: (...args) => archiveProjectPreview(ctx, ...args),
    archiveProject: (...args) => archiveProject(ctx, ...args),
    unarchive: (...args) => unarchive(ctx, ...args),
    purgeArchive: (...args) => purgeArchive(ctx, ...args),
    mutateArchive: (...args) => mutateArchive(ctx, ...args),
    recoverSession: (...args) => recoverSession(ctx, ...args),
    getTarget: (...args) => getTarget(ctx, ...args),
    inspectTarget: (...args) => inspectTarget(ctx, ...args),
    browseTarget: (...args) => browseTarget(ctx, ...args),
    saveTarget: (...args) => saveTarget(ctx, ...args),
    deleteTarget: (...args) => deleteTarget(ctx, ...args),
    deployEnvironment: (...args) => deployEnvironment(ctx, ...args),
    setDraft: (...args) => setDraft(ctx, ...args),
    setQueue: (...args) => setQueue(ctx, ...args),
    setViewMode: (...args) => setViewMode(ctx, ...args),
    savePresentation: (...args) => savePresentation(ctx, ...args),
    noteScroll: (...args) => noteScroll(ctx, ...args),
    flushScroll: (...args) => flushScroll(ctx, ...args),
    handleLocationChange: (...args) => handleLocationChange(ctx, ...args),
    handleConnectionResume: (...args) => handleConnectionResume(ctx, ...args),
    start: (...args) => start(ctx, ...args),
    dispose: (...args) => dispose(ctx, ...args),
  };
  initializeStoreContext(ctx);
  const actions = createWorkbenchActions(ctx);

  return {
    getSnapshot: () => ctx.state,
    subscribe: ctx.bound.subscribe,
    actions,
    start: ctx.bound.start,
    dispose: ctx.bound.dispose,
  };
}

