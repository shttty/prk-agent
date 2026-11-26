import type { StoreContext } from "../store-context-types.ts";
import { requestId } from "../requests/request-id.ts";
import { sessionRequestCurrent } from "../selection/session-request-current.ts";
import { postJson } from "../requests/post-json.ts";
import { isRecord } from "../../payloads/is-record.ts";
import { nativePath } from "./native-path.ts";
import { applyNativeActionResult } from "./apply-native-action-result.ts";
import { upsertNativeFeedback } from "./upsert-native-feedback.ts";

export async function cancelNativeAction(ctx: StoreContext, requestIdValue: string): Promise<boolean> {
  const current = ctx.state.session.nativeFeedback.find((entry) => entry.requestId === requestIdValue);
  const name = ctx.state.selectedSessionId;
  if (!name || !current || current.status !== "running" || current.cancellable !== true || ctx.state.session.connection !== "connected") return false;
  const cancellationRequestId = requestId();
  const isCurrent = sessionRequestCurrent(ctx);
  try {
    const result = await postJson(nativePath(ctx, name), { requestId: cancellationRequestId, action: "cancel-native", args: { requestId: requestIdValue } });
    if (!isCurrent()) return false;
    const feedback = await applyNativeActionResult(ctx, result, { requestId: cancellationRequestId, action: "cancel-native" });
    const acknowledged = feedback.status === "completed" && isRecord(feedback.data) && feedback.data.acknowledged === true;
    if (acknowledged) upsertNativeFeedback(ctx, { ...current, cancellable: false, message: "已请求取消。" });
    return acknowledged;
  } catch (error) {
    if (isCurrent()) await applyNativeActionResult(ctx, null, { requestId: cancellationRequestId, action: "cancel-native", message: error instanceof Error ? error.message : "原生操作取消失败。" });
    return false;
  }
}
