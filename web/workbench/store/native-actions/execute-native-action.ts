import type { StoreContext } from "../store-context-types.ts";
import { hostState } from "../selection/host-state.ts";
import { requestId } from "../requests/request-id.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { upsertNativeFeedback } from "./upsert-native-feedback.ts";
import { patchSession } from "../updates/patch-session.ts";
import { withPending } from "../updates/with-pending.ts";
import { postJson } from "../requests/post-json.ts";
import { nativePath } from "./native-path.ts";
import { nativeActionResult } from "./native-action-result.ts";
import { applyNativeActionResult } from "./apply-native-action-result.ts";
import { lightSettingChanges } from "./light-setting-changes.ts";
import { LIGHT_SETTINGS, updateLightSetting } from "./update-light-setting.ts";

const READ_ONLY_ACTIONS = ["help", "hotkeys", "changelog", "session", "export", "copy", "tree-read", "tree-copy", "tree-filter", "tree-fold", "fork-reply"];

export async function executeNativeAction(ctx: StoreContext, action: string, args: Record<string, unknown> = {}, { transcript = true }: { transcript?: boolean } = {}): Promise<boolean> {
  const name = ctx.state.selectedSessionId;
  if (!name) return false;
  const readOnlyAction = READ_ONLY_ACTIONS.includes(action);
  if (ctx.state.session.connection !== "connected" && !readOnlyAction) return false;
  if (["closed", "closing"].includes(hostState(ctx)) && !readOnlyAction) return false;
  const id = requestId();
  const isCurrent = sessionRequestCurrent(ctx);
  const cancellable = action === "compact" || (action === "tree" && args.summarize === true);
  const lightSetting = Object.hasOwn(LIGHT_SETTINGS, action) ? LIGHT_SETTINGS[action] : undefined;
  const blocksNativeActions = !lightSetting && action !== "fork-reply";
  const rollback = lightSetting ? updateLightSetting(ctx, lightSettingChanges({ [lightSetting.field]: args[lightSetting.arg] })) : null;
  if (transcript && action !== "compact") upsertNativeFeedback(ctx, { requestId: id, action, status: "running", message: "正在执行…", ...(cancellable ? { cancellable: true } : {}) });
  patchSession(ctx, { ...(!transcript ? { error: null } : {}), ...(blocksNativeActions ? { pending: withPending(ctx.state.session.pending, "nativeActionPending", true) } : {}) });
  try {
    const result = await postJson(nativePath(ctx, name), { requestId: id, action, args });
    if (!isCurrent()) return nativeActionResult(result) && ["completed", "running"].includes(result.status);
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
    if (blocksNativeActions && isCurrent()) patchSession(ctx, { pending: withPending(ctx.state.session.pending, "nativeActionPending", false) });
  }
}
