import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { result } from "../dispatch/format-action-result.ts";
import { actionFailure } from "../dispatch/action-failure.ts";

export async function actExtensionUi(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): Promise<NativeActionResult> {
  if (target.readOnly || !target.host?.extensionUiAction) return result(request, "unavailable", "Extension UI requires an active selected session.", { executed: false, streamId: target.streamId });
  const args = request.args ?? {};
  try {
    const data = await target.host.extensionUiAction(args);
    if (args.operation === "render") return result(request, "completed", "Extension UI rendered.", data);
    const response = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const status = response.status === "cancelled" || response.status === "unavailable" ? response.status : "completed";
    return result(request, status, typeof response.message === "string" ? response.message : "Extension UI action completed.", response);
  } catch (error) {
    const failure = actionFailure(request, error);
    return { ...failure, data: { ...(failure.data as Record<string, unknown>), streamId: target.streamId } };
  }
}
