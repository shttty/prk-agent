import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { result } from "./format-action-result.ts";
import { argumentText } from "./read-text-argument.ts";
import { operationKey } from "./identify-request.ts";

export async function cancelNative(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  const { running } = ctx;
  const requestId = argumentText(request.args, "requestId");
  if (!requestId) return result(request, "failed", "cancel-native requires args.requestId identifying the original target operation.", { executed: false });
  const pending = running.get(operationKey(target, requestId));
  if (!pending) return result(request, "unavailable", "No running native operation matched this request ID.", { executed: false });
  try { await pending.cancel(); }
  catch (error) { return result(request, "unavailable", error instanceof Error ? error.message : String(error), { executed: false }); }
  return result(request, "completed", "Native operation cancellation was requested; the target operation will report its actual outcome.", { executed: true, requestId, sessionId: target.sessionId, acknowledged: true, outcomePending: true, targetAction: pending.action });
}
