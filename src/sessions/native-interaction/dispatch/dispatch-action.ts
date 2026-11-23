import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeActionContext, NativeTarget } from "../native-types.ts";
import { replyForkAction } from "../catalog/command-metadata.ts";
import { commandAvailability } from "../catalog/command-availability.ts";
import { findCommand } from "../catalog/find-command.ts";
import { result } from "./format-action-result.ts";
import { actionFailure } from "./action-failure.ts";
import { operationKey } from "./identify-request.ts";
import { setToolMode } from "../settings/set-tool-mode.ts";
import { setKernelLanguage } from "../settings/set-kernel-language.ts";
import { setDelegation } from "../settings/set-delegation.ts";
import { setLocalTools } from "../settings/set-local-tools.ts";
import { setCapabilities } from "../settings/set-capabilities.ts";
import { actExtensionUi } from "../presentation/act-extension-ui.ts";
import { listReferences } from "../references/list-references.ts";
import { cancelNative } from "./cancel-native.ts";
import { dequeue } from "../input/dequeue.ts";
import { readReference } from "../references/read-reference.ts";
import { actTreeMetadata } from "../history/tree/act-tree-metadata.ts";
import { setSettings } from "../settings/set-settings.ts";
import { readHotkeys } from "../presentation/read-hotkeys.ts";
import { installedRelease } from "../presentation/read-release.ts";
import { exportSession } from "../history/export-session.ts";
import { copyReply } from "../history/copy-reply.ts";
import { readSessionStats } from "../history/read-session-stats.ts";
import { setModel } from "../settings/set-model.ts";
import { setThinking } from "../settings/set-thinking.ts";
import { setScopedModels } from "../settings/set-scoped-models.ts";
import { renameSession } from "../history/rename-session.ts";
import { compact } from "../history/compact.ts";
import { navigateTree } from "../history/tree/navigate-tree.ts";
import { changeLifecycle } from "../lifecycle/change-lifecycle.ts";
import { reload } from "../lifecycle/reload.ts";
import { showPresentation } from "../presentation/show-presentation.ts";
import { leaveView } from "../presentation/leave-view.ts";

export async function action(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  const { activeRequests, running } = ctx;
  if (request.sessionId !== target.sessionId) return { requestId: request.requestId, action: request.action, status: "failed", message: "Native action routing identity does not match the selected Gateway session.", data: { executed: false, streamId: target.streamId } };
  if (request.action === "tool-mode") return setToolMode(ctx, target, request);
  if (request.action === "kernel-language") return setKernelLanguage(target, request);
  if (request.action === "delegation") return setDelegation(ctx, target, request);
  if (request.action === "local-tools") return setLocalTools(ctx, target, request);
  if (request.action === "capabilities") return setCapabilities(ctx, target, request);
  if (request.action === "extension-ui") return actExtensionUi(ctx, target, request);
  if (request.action === "reference-candidates") return listReferences(ctx, target, request);
  if (request.action === "cancel-native") return cancelNative(ctx, target, request);
  if (request.action === "dequeue") return dequeue(ctx, target, request);
  if (request.action === "reference-read") return readReference(ctx, target, request);
  if (["tree-read", "tree-label", "tree-filter", "tree-fold", "tree-copy"].includes(request.action)) return actTreeMetadata(ctx, target, request);
  const command = request.action === replyForkAction.name
    ? { ...replyForkAction, availability: commandAvailability(replyForkAction, target) }
    : findCommand(target, request.action);
  if (!command) return result(request, "unavailable", `Unknown native command /${request.action}; nothing was executed.`, { executed: false });
  if (command.source === "skill" || command.source === "template" || target.session?.extensionRunner.getCommand(command.name)) {
    return result(request, "unavailable", "Invoke this SDK resource through slash-command send, not nativeAction.", { executed: false });
  }
  if (!command.availability.enabled) return result(request, "unavailable", command.availability.reason ?? `/${request.action} is unavailable.`, { executed: false });
  const requestKey = operationKey(target, request.requestId);
  if (activeRequests.has(requestKey)) return result(request, "unavailable", "This native request is already active; it was not replayed.", { executed: false, active: true });
  activeRequests.add(requestKey);
  const operation: NativeActionContext = {};
  try {
    const session = target.session;
    let data: unknown;
    if (request.action === "settings") {
      data = setSettings(ctx, target, request);
    } else if (request.action === "hotkeys") {
      data = readHotkeys(ctx, target, request);
    } else if (request.action === "changelog") {
      data = await installedRelease();
    } else if (request.action === "export") {
      data = await exportSession(ctx, target, request);
    } else if (request.action === "copy") {
      data = copyReply(ctx, target, request, session);
    } else if (request.action === "session") {
      data = readSessionStats(ctx, target, request, session);
    } else if (request.action === "model") {
      data = await setModel(ctx, target, request);
    } else if (request.action === "thinking") {
      data = setThinking(ctx, target, request);
    } else if (request.action === "scoped-models") {
      data = setScopedModels(ctx, target, request);
    } else if (request.action === "name") {
      data = await renameSession(target, request);
    } else if (request.action === "compact") {
      data = await compact(ctx, target, request, operation);
    } else if (request.action === "tree") {
      const navigation = await navigateTree(ctx, target, request, operation);
      if (navigation.cancelled) return result(request, "cancelled", "Native tree navigation was cancelled; the prior branch remains active. Model work already performed is not undone.", navigation);
      data = navigation;
    } else if (request.action === "new" || request.action === "clone" || request.action === "fork-reply") {
      data = await changeLifecycle(ctx, target, request, request.action);
    } else if (request.action === "reload") {
      data = await reload(ctx, target, request);
    } else if (request.action === "arminsayshi" || request.action === "dementedelves") {
      data = showPresentation(ctx, target, request);
    } else if (request.action === "quit") {
      data = leaveView(ctx, target, request);
    } else {
      throw new WireError("UNAVAILABLE", "This command is exposed for truthful capability discovery but has no chat-side side effect.");
    }
    return result(request, "completed", `/${request.action} completed.`, data);
  } catch (error) {
    return actionFailure(request, error);
  } finally {
    if (operation.runningCancel) running.delete(operationKey(target, request.requestId));
    activeRequests.delete(requestKey);
  }
}
