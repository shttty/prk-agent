import { requestId } from "../requests/request-id.js";
import { sessionRequestCurrent } from "../selection/session-request-current.js";
import { postJson } from "../requests/post-json.js";
import { nativePath } from "./native-path.js";
import { applyNativeActionResult } from "./apply-native-action-result.js";
import { upsertNativeFeedback } from "./upsert-native-feedback.js";
export async function cancelNativeAction(ctx, requestIdValue) {
    const current = ctx.state.session.nativeFeedback.find((entry) => entry.requestId === requestIdValue);
    const name = ctx.state.selectedSessionId;
    if (!name || !current || current.status !== "running" || current.cancellable !== true || ctx.state.session.connection !== "connected") return false;
    const cancellationRequestId = requestId();
    const isCurrent = sessionRequestCurrent(ctx);
    try {
      const result = await postJson(ctx, nativePath(ctx, name), { requestId: cancellationRequestId, action: "cancel-native", args: { requestId: requestIdValue } });
      if (!isCurrent()) return false;
      const feedback = await applyNativeActionResult(ctx, result, { requestId: cancellationRequestId, action: "cancel-native" });
      const acknowledged = feedback.status === "completed" && feedback.data?.acknowledged === true;
      if (acknowledged) upsertNativeFeedback(ctx, { ...current, cancellable: false, message: "已请求取消。" });
      return acknowledged;
    } catch (error) {
      if (isCurrent()) await applyNativeActionResult(ctx, null, { requestId: cancellationRequestId, action: "cancel-native", message: error instanceof Error ? error.message : "原生操作取消失败。" });
      return false;
    }
  }

