import type { NativeActionRequest, NativeActionResult } from "../../../gateway/wire/wire-types.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { result } from "../dispatch/format-action-result.ts";
import { actionFailure } from "../dispatch/action-failure.ts";

export function setLocalTools(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest): NativeActionResult {
  try {
    if (target.readOnly) throw new WireError("UNAVAILABLE", "Local tools require a writable session.");
    if (!target.setLocalTools) throw new WireError("UNAVAILABLE", "This session cannot change local tools.");
    const enabled = request.args?.enabled;
    if (Object.keys(request.args ?? {}).some((key) => key !== "enabled") || typeof enabled !== "boolean") throw new WireError("INVALID_REQUEST", "Local tools require exactly {enabled: boolean}.");
    target.setLocalTools(enabled);
    return result(request, "completed", "Local tools updated.", { localTools: enabled });
  } catch (error) { return actionFailure(request, error); }
}
