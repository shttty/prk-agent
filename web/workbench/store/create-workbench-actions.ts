import type { StoreContext } from "./store-context-types.ts";
import { setShowImages } from "./set-show-images.ts";
import { getJson } from "./requests/get-json.ts";
import { requestJson } from "./requests/request-json.ts";
import { postSettled } from "./requests/post-settled.ts";
import { resendUnknownSends } from "./messages/resend-unknown-sends.ts";
import { returnUnknownSends } from "./messages/return-unknown-sends.ts";
import { start } from "./lifecycle/start.ts";
import { designateRole } from "./session-control/designate-role.ts";
import { reloadTargets } from "./targets/reload-targets.ts";
import { selectSession } from "./selection/select-session.ts";
import { extensionUiAction } from "./extension-ui/extension-ui-action.ts";
import { requestExtensionUiRender } from "./extension-ui/request-extension-ui-render.ts";
import { loadToolContent } from "./tool-content/load-tool-content.ts";
import { loadTranscriptContent } from "./tool-content/load-transcript-content.ts";
import { loadHistoryPage } from "./session-stream/load-history-page.ts";
import { nativeData } from "./native-actions/native-data.ts";
import { executeNativeAction } from "./native-actions/execute-native-action.ts";
import { forkMessage } from "./native-actions/fork-message.ts";
import { rerunMessage } from "./native-actions/rerun-message.ts";
import { cancelNativeAction } from "./native-actions/cancel-native-action.ts";
import { loadReferenceCandidates } from "./references/load-reference-candidates.ts";
import { clearReferenceCandidates } from "./references/clear-reference-candidates.ts";
import { setAttachments } from "./drafts/set-attachments.ts";
import { setReferences } from "./drafts/set-references.ts";
import { setDraft } from "./drafts/set-draft.ts";
import { setQueue } from "./drafts/set-queue.ts";
import { setViewMode } from "./view-mode/set-view-mode.ts";
import { savePresentation } from "./drafts/save-presentation.ts";
import { noteScroll } from "./drafts/note-scroll.ts";
import { flushScroll } from "./drafts/flush-scroll.ts";
import { clearError } from "./notices/clear-error.ts";
import { clearNotice } from "./notices/clear-notice.ts";
import { sendMessage } from "./messages/send-message.ts";
import { cancelOperation } from "./messages/cancel-operation.ts";
import { reconnect } from "./session-stream/reconnect.ts";
import { createSession } from "./session-management/create-session.ts";
import { renameSession } from "./session-management/rename-session.ts";
import { manageSession } from "./session-management/manage-session.ts";
import { assignProject } from "./session-management/assign-project.ts";
import { archiveSession } from "./session-management/archive-session.ts";
import { archivePreview } from "./session-management/archive-preview.ts";
import { archiveProjectPreview } from "./session-management/archive-project-preview.ts";
import { archiveProject } from "./session-management/archive-project.ts";
import { unarchive } from "./session-management/unarchive.ts";
import { purgeArchive } from "./session-management/purge-archive.ts";
import { recoverSession } from "./session-management/recover-session.ts";
import { wakeSession } from "./session-management/wake-session.ts";
import { getTarget } from "./targets/get-target.ts";
import { inspectTarget } from "./targets/inspect-target.ts";
import { browseTarget } from "./targets/browse-target.ts";
import { saveTarget } from "./targets/save-target.ts";
import { deleteTarget } from "./targets/delete-target.ts";
import { deployEnvironment } from "./targets/deploy-environment.ts";

/** What pages call: every store function with the context bound in. */
export type WorkbenchActions = ReturnType<typeof createWorkbenchActions>;

export function createWorkbenchActions(ctx: StoreContext) {
  const bind = <Args extends unknown[], Result>(action: (ctx: StoreContext, ...args: Args) => Result) => (...args: Args): Result => action(ctx, ...args);
  return {
    start: bind(start),
    designateRole: bind(designateRole),
    reloadTargets: bind(reloadTargets),
    selectSession: bind(selectSession),
    extensionUiAction: bind(extensionUiAction),
    requestExtensionUiRender: bind(requestExtensionUiRender),
    loadToolContent: bind(loadToolContent),
    loadTranscriptContent: bind(loadTranscriptContent),
    loadHistoryPage: bind(loadHistoryPage),
    nativeData: bind(nativeData),
    executeNativeAction: bind(executeNativeAction),
    forkMessage: bind(forkMessage),
    rerunMessage: bind(rerunMessage),
    cancelNativeAction: bind(cancelNativeAction),
    loadReferenceCandidates: bind(loadReferenceCandidates),
    clearReferenceCandidates: bind(clearReferenceCandidates),
    setAttachments: bind(setAttachments),
    setReferences: bind(setReferences),
    setDraft: bind(setDraft),
    setQueue: bind(setQueue),
    setViewMode: bind(setViewMode),
    savePresentation: bind(savePresentation),
    setShowImages: bind(setShowImages),
    noteScroll: bind(noteScroll),
    flushScroll: bind(flushScroll),
    clearError: bind(clearError),
    clearNotice: bind(clearNotice),
    sendMessage: bind(sendMessage),
    resendUnknownSends: bind(resendUnknownSends),
    returnUnknownSends: bind(returnUnknownSends),
    cancelOperation: bind(cancelOperation),
    reconnect: bind(reconnect),
    createSession: bind(createSession),
    renameSession: bind(renameSession),
    manageSession: bind(manageSession),
    assignProject: bind(assignProject),
    renameProject: (projectId: string, name: string) => requestJson(`${ctx.apiRoot}/projects/${encodeURIComponent(projectId)}/rename`, { method: "POST", body: JSON.stringify({ name }) }),
    archiveSession: bind(archiveSession),
    archivePreview: bind(archivePreview),
    archiveProjectPreview: bind(archiveProjectPreview),
    archiveProject: bind(archiveProject),
    unarchive: bind(unarchive),
    purgeArchive: bind(purgeArchive),
    recoverSession: bind(recoverSession),
    wakeSession: bind(wakeSession),
    getTarget: bind(getTarget),
    inspectTarget: bind(inspectTarget),
    browseTarget: bind(browseTarget),
    saveTarget: bind(saveTarget),
    deleteTarget: bind(deleteTarget),
    deployEnvironment: bind(deployEnvironment),
    // Raw same-origin /api access for workbench panels (files, terminals, kernel, tools).
    // Errors are `RequestError`s: `.code`, `.details` and `.status` come from the backend body.
    api: {
      root: ctx.apiRoot,
      get: (path: string) => getJson(`${ctx.apiRoot}${path}`),
      post: bind(postSettled),
      upload: (path: string, file: Blob) => requestJson(`${ctx.apiRoot}${path}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file }),
    },
  };
}
