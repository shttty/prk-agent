import { nativeActionDescriptor } from "./native-action-descriptor.js";
import { hostState } from "../selection/host-state.js";
import { requestId } from "../requests/request-id.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { upsertNativeFeedback } from "./upsert-native-feedback.js";
import { patchSession } from "../updates/patch-session.js";
import { withPending } from "../updates/with-pending.js";
import { postJson } from "../requests/post-json.js";
import { nativePath } from "./native-path.js";
import { applyNativeActionResult } from "./apply-native-action-result.js";
import { LIGHT_SETTING_ACTIONS, LIGHT_SETTING_FIELDS, updateLightSetting } from "./update-light-setting.js";
export async function executeNativeAction(ctx, action, args = {}, { transcript = true } = {}) {
    const name = ctx.state.selectedSessionId;
    if (!name) return false;
    const descriptor = nativeActionDescriptor(ctx, action);
    const readOnlyAction = descriptor?.readOnly === true || descriptor?.mutation === false || ["help", "hotkeys", "changelog", "session", "export", "copy", "tree-read", "tree-copy", "tree-filter", "tree-fold", "fork-reply"].includes(action);
    if (ctx.state.session.connection !== "connected" && !readOnlyAction) return false;
    if (["closed", "closing"].includes(hostState(ctx)) && !readOnlyAction) return false;
    const id = requestId();
    const isCurrent = sessionRequestCurrent(ctx);
    const cancellable = descriptor?.cancellable === true || descriptor?.availability?.cancellable === true || action === "compact" || (action === "tree" && args?.summarize === true);
    const lightSetting = LIGHT_SETTING_ACTIONS.has(action);
    const value = args[{ model: "model", thinking: "level", "tool-mode": "mode", delegation: "level" }[action]];
    const rollback = lightSetting ? updateLightSetting(ctx, { [LIGHT_SETTING_FIELDS[action]]: value }) : null;
    if (transcript && action !== "compact") upsertNativeFeedback(ctx, { requestId: id, action, status: "running", message: "正在执行…", ...(cancellable ? { cancellable: true } : {}) });
    patchSession(ctx, { ...(!transcript ? { error: null } : {}), ...(!lightSetting ? { pending: withPending(ctx.state.session.pending, "nativeActionPending", true) } : {}) });
    try {
      const result = await postJson(ctx, nativePath(ctx, name), { requestId: id, action, args });
      if (!isCurrent()) return ["completed", "running"].includes(result?.status);
      const feedback = await applyNativeActionResult(ctx, result, { requestId: id, action, ...(cancellable ? { cancellable: true } : {}) }, { transcript });
      if (feedback.status !== "completed") rollback?.();
      return ["completed", "running"].includes(feedback.status);
    } catch (error) {
      if (isCurrent()) {
        rollback?.();
        await applyNativeActionResult(ctx, null, { requestId: id, action, message: error instanceof Error ? error.message : "原生操作失败。" }, { transcript });
      }
      return false;
    } finally {
      if (!lightSetting && isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "nativeActionPending", false) });
    }
  }

