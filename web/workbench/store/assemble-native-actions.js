import { loadToolContent } from "./tool-content/load-tool-content.js";
import { loadTranscriptContent } from "./tool-content/load-transcript-content.js";
import { loadNativeCatalog } from "./native-actions/load-native-catalog.js";
import { nativeFeedbackForSession } from "./native-actions/native-feedback-for-session.js";
import { upsertNativeFeedback } from "./native-actions/upsert-native-feedback.js";
import { nativeActionResult } from "./native-actions/native-action-result.js";
import { extensionUiRevision } from "./extension-ui/extension-ui-revision.js";
import { acceptExtensionUi } from "./extension-ui/accept-extension-ui.js";
import { extensionUiAction } from "./extension-ui/extension-ui-action.js";
import { requestExtensionUiRender } from "./extension-ui/request-extension-ui-render.js";
import { scheduleExtensionUiRender } from "./extension-ui/schedule-extension-ui-render.js";
import { nativeActionDescriptor } from "./native-actions/native-action-descriptor.js";
import { applyNativeActionResult } from "./native-actions/apply-native-action-result.js";
import { executeNativeAction } from "./native-actions/execute-native-action.js";
import { nativeData } from "./native-actions/native-data.js";
import { forkMessage } from "./native-actions/fork-message.js";
import { rerunMessage } from "./native-actions/rerun-message.js";
import { cancelNativeAction } from "./native-actions/cancel-native-action.js";
export function assembleNativeActions(ctx) {
  return {
    loadToolContent: (...args) => loadToolContent(ctx, ...args),
    loadTranscriptContent: (...args) => loadTranscriptContent(ctx, ...args),
    loadNativeCatalog: (...args) => loadNativeCatalog(ctx, ...args),
    nativeFeedbackForSession: (...args) => nativeFeedbackForSession(ctx, ...args),
    upsertNativeFeedback: (...args) => upsertNativeFeedback(ctx, ...args),
    nativeActionResult: (...args) => nativeActionResult(ctx, ...args),
    extensionUiRevision: (...args) => extensionUiRevision(ctx, ...args),
    acceptExtensionUi: (...args) => acceptExtensionUi(ctx, ...args),
    extensionUiAction: (...args) => extensionUiAction(ctx, ...args),
    requestExtensionUiRender: (...args) => requestExtensionUiRender(ctx, ...args),
    scheduleExtensionUiRender: (...args) => scheduleExtensionUiRender(ctx, ...args),
    nativeActionDescriptor: (...args) => nativeActionDescriptor(ctx, ...args),
    applyNativeActionResult: (...args) => applyNativeActionResult(ctx, ...args),
    executeNativeAction: (...args) => executeNativeAction(ctx, ...args),
    nativeData: (...args) => nativeData(ctx, ...args),
    forkMessage: (...args) => forkMessage(ctx, ...args),
    rerunMessage: (...args) => rerunMessage(ctx, ...args),
    cancelNativeAction: (...args) => cancelNativeAction(ctx, ...args),
  };
}
